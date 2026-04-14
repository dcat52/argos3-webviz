# Proposal: Dynamic Computed Fields & Controller State Exposure

Created: 2026-04-13
Baseline Commit: `aa1ffd1` (`client-next`)
GitHub Issue: N/A <!-- #N once published -->

## Status: 📋 INVESTIGATION
<!-- 📋 INVESTIGATION → 🔍 CRITIQUE → 🟡 DESIGN → 🔍 CRITIQUE → 🔵 IMPLEMENTATION → 🟣 VERIFICATION → ✅ COMPLETE / 🔴 ABANDONED -->

## Goal

Enable new visualizations without C++ recompilation by: (1) computing derived
fields client-side from data already in the broadcast, and (2) providing a
lightweight mechanism to expose controller internal state to webviz.

## Scope Boundary

**In scope:**
- Client-side computed fields derived from broadcast data (position, orientation, LEDs)
- Built-in computed field library (speed, heading, distance, clustering)
- User-defined computed fields via expression editor in the UI
- C++ `WEBVIZ_EXPOSE()` macro for one-line controller state registration
- Generic webviz user_functions that serializes exposed fields automatically
- LED color interpretation as categorical state

**Out of scope:**
- ❌ Modifying existing ARGoS controllers (we provide the mechanism, not the migration)
- ❌ Bidirectional state editing (read-only exposure)
- ❌ Real-time C++ hot-reload
- ❌ Custom rendering shaders

## Current State

**What's already broadcast per entity (no C++ changes needed):**

| Field | Type | Available For | Notes |
|---|---|---|---|
| `position` | `{x, y, z}` | All entities | Updated every tick |
| `orientation` | `{x, y, z, w}` quaternion | All entities | Updated every tick |
| `leds` | `string[]` | RobotEntity (foot-bot, kheperaiv) | LED colors as strings, e.g. `"red"`, `"black"` |
| `rays` | `string[]` | RobotEntity | Sensor rays |
| `user_data` | `unknown` | Any entity (if user_functions set) | Per-entity JSON from `Call()` |
| `user_data` (global) | `unknown` | Broadcast-level | From `sendUserData()` |

**What's NOT broadcast (locked inside controllers):**
- `m_unCounter` (synchronization) — only visible via LED flash
- `sFoodData.HasFoodItem` (foraging) — only visible via QT cylinder draw
- `key_count`, `total_keys`, `root_hash` (Canopy sync) — only in `viz_registry`
- `m_bHasBeacon` (Canopy diffusion) — only in `viz_registry`
- Flocking vector magnitude, neighbor count, internal FSM state

**What exists in the codebase:**
- `vizEngine.ts` discovers `user_data` fields and classifies types
- `vizConfigStore.ts` maps discovered fields to visual channels
- `VizConfigPanel.tsx` lets users select fields from dropdowns
- `CWebvizUserFunctions` has `Call(CEntity&)` for per-entity JSON and
  `sendUserData()` for global JSON — the hooks exist, they're just underused

## Affected Components

- [x] Next client (`client-next/`) — computed field engine, expression editor
- [x] C++ plugin (`src/`) — `WEBVIZ_EXPOSE` macro, generic user_functions
- [ ] Legacy client (`client/`)
- [ ] Protocol / message format (no changes — uses existing `user_data`)
- [ ] Build system / CMake
- [x] Documentation — computed fields guide, WEBVIZ_EXPOSE guide

## Design

### Part 1: Client-Side Computed Fields (No C++ Changes)

A computed field engine that derives new fields from existing broadcast data.
These fields appear in the viz config field selectors alongside server-provided
fields.

#### Built-in Computed Fields

| Field | Derivation | Input | Notes |
|---|---|---|---|
| `_speed` | `dist(pos, prev_pos) / dt` | `position` (current + previous frame) | Scalar, units/tick |
| `_heading` | `atan2(dy, dx)` from position delta | `position` (current + previous frame) | Radians |
| `_distance_to_center` | `dist(pos, arena.center)` | `position`, `arena` | Scalar |
| `_distance_to_nearest` | `min(dist(pos, other.pos))` | All entity positions | Scalar |
| `_neighbor_count` | Count entities within radius R | All entity positions | Integer, R configurable |
| `_cluster_id` | DBSCAN on positions | All entity positions | Integer, ε + minPts configurable |
| `_led_state` | Dominant LED color as category | `leds[]` | String, e.g. `"red"`, `"black"` |
| `_led_changed` | LED color differs from previous frame | `leds[]` (current + previous) | Boolean — detects flashes |

Prefix `_` distinguishes computed fields from server-provided ones.

#### Implementation

```typescript
// src/lib/computedFields.ts

interface ComputedFieldDef {
  name: string
  type: 'number' | 'string' | 'boolean'
  description: string
  params?: { name: string; default: number }[]
  compute: (ctx: ComputeContext) => unknown
}

interface ComputeContext {
  entity: AnyEntity
  prevEntity: AnyEntity | undefined  // previous frame
  allEntities: Map<string, AnyEntity>
  arena: ArenaInfo
  dt: number  // ticks since last frame
}

const builtinFields: ComputedFieldDef[] = [
  {
    name: '_speed',
    type: 'number',
    description: 'Movement speed (units/tick)',
    compute: ({ entity, prevEntity, dt }) => {
      if (!prevEntity || !('position' in entity)) return 0
      const dx = entity.position.x - prevEntity.position.x
      const dy = entity.position.y - prevEntity.position.y
      return Math.sqrt(dx * dx + dy * dy) / dt
    },
  },
  {
    name: '_led_state',
    type: 'string',
    description: 'Dominant LED color',
    compute: ({ entity }) => {
      if (!('leds' in entity) || !entity.leds?.length) return 'none'
      // Most common non-black LED color
      const colors = entity.leds.filter((c: string) => c !== 'black')
      return colors.length > 0 ? colors[0] : 'black'
    },
  },
  // ... etc
]
```

The computed field engine runs after each broadcast, stores results in a
parallel map, and `vizEngine.ts` includes them in field discovery.

#### LED Color Interpretation

This deserves special attention because it's the highest-value zero-change
feature. Many ARGoS experiments encode state in LEDs:

| Experiment | LED Meaning | Computed Field |
|---|---|---|
| synchronization | RED flash = counter overflow | `_led_state` = `"red"` or `"black"` |
| flocking | RED beacon = visible to neighbors | `_led_state` = `"red"` |
| foraging | Color encodes FSM state | `_led_state` = categorical |

`_led_state` as a categorical color-by field immediately gives you meaningful
visualization for these experiments with zero server-side changes.

### Part 2: User-Defined Computed Fields (UI Expression Editor)

Let users define custom computed fields in the VizConfigPanel:

```
[+ Add Field]
  Name: "isolated"
  Expression: _neighbor_count == 0

[+ Add Field]  
  Name: "fast_movers"
  Expression: _speed > 0.1
```

#### Expression Language

Minimal safe expression evaluator (no `eval`):

- Arithmetic: `+`, `-`, `*`, `/`, `%`
- Comparison: `==`, `!=`, `>`, `<`, `>=`, `<=`
- Logic: `&&`, `||`, `!`
- Math functions: `sqrt`, `abs`, `min`, `max`, `dist`
- Field access: `position.x`, `_speed`, `user_data.battery`
- Previous frame: `prev.position.x`
- Constants: numbers, `true`, `false`, quoted strings

This is intentionally limited — no loops, no side effects, no function
definitions. Just field-level expressions.

### Part 3: Autonomous Actuator State Extraction (C++ Serializer Changes, No Controller Changes)

The webviz entity serializers currently only send position, orientation, LEDs,
rays, and points. But the entity component architecture exposes much more state
through public getters — accessible without any controller cooperation.

#### What's Accessible vs What's Currently Sent

| Component | Entity Class | Getter | FootBot | KheperaIV | Leo | Currently Sent? |
|---|---|---|---|---|---|---|
| Position | `CEmbodiedEntity` | `GetOriginAnchor().Position` | ✅ | ✅ | ✅ | ✅ Yes |
| Orientation | `CEmbodiedEntity` | `GetOriginAnchor().Orientation` | ✅ | ✅ | ✅ | ✅ Yes |
| LED colors | `CLEDEquippedEntity` | `GetLED(i).GetColor()` | 13 LEDs | 3 LEDs | ❌ None | ✅ Yes (colors only) |
| Rays | `CControllableEntity` | `GetCheckedRays()` | ✅ | ✅ | ✅ | ✅ Yes |
| Wheel speeds | `CWheeledEntity` | `GetWheelVelocities()` | ✅ | ✅ | ❌ | ❌ **No** |
| Gripper state | `CGripperEquippedEntity` | `GetLockState()`, `IsGripping()` | ✅ | ❌ | ❌ | ❌ **No** |
| RAB data | `CRABEquippedEntity` | `GetData()` | ✅ | ✅ | ✅ | ❌ **No** |
| Battery charge | `CBatteryEquippedEntity` | `GetAvailableCharge()` | ✅ | ✅ | ✅ | ❌ **No** |
| Turret rotation | `CFootBotTurretEntity` | `GetRotation()`, `GetMode()` | ✅ | ❌ | ❌ | ❌ **No** |
| Distance scanner | `CFootBotDistanceScannerEquippedEntity` | `GetRotation()`, `GetMode()` | ✅ | ❌ | ❌ | ❌ **No** |
| Linear velocity | `CLeoEntity` (direct member) | `m_fLinearVelocity` | ❌ | ❌ | ✅ | ❌ **No** |

**NOT extractable** (computed dynamically by physics engine each step):
- Proximity sensor readings
- Light sensor readings
- Ground sensor readings
- Camera blob detections

#### Implementation

Extend the existing entity serializers to include the new fields. The data
goes into the existing entity JSON — no protocol changes needed, client-next
auto-discovers new fields via `vizEngine.ts`.

```cpp
// In webviz_kheperaiv.cpp — add to ApplyTo():

// Wheel speeds
const Real* pWheelSpeeds = c_entity.GetWheeledEntity().GetWheelVelocities();
cJson["wheel_speeds"] = { pWheelSpeeds[0], pWheelSpeeds[1] };

// Battery
cJson["battery"] = c_entity.GetBatterySensorEquippedEntity().GetAvailableCharge();

// RAB data (as hex string or byte array)
const CByteArray& cRABData = c_entity.GetRABEquippedEntity().GetData();
cJson["rab_data_size"] = cRABData.Size();
// Optionally: cJson["rab_data"] = base64_encode(cRABData);
```

```cpp
// In webviz_footbot.cpp — add to ApplyTo():

// Same as kheperaiv, plus:
cJson["gripper_lock"] = c_entity.GetGripperEquippedEntity().GetLockState();
cJson["gripper_gripping"] = c_entity.GetGripperEquippedEntity().IsGripping();
cJson["turret_rotation"] = c_entity.GetTurretEntity().GetRotation().GetValue();
cJson["turret_mode"] = c_entity.GetTurretEntity().GetMode();
cJson["distance_scanner_rotation"] = c_entity.GetDistanceScannerEquippedEntity().GetRotation().GetValue();
```

#### Opt-In via XML Config

To avoid bandwidth overhead for experiments that don't need it:

```xml
<webviz port="3000" extended_state="true" />
```

When `extended_state="false"` (default), serializers send only the current
fields (position, orientation, LEDs, rays, points) — fully backwards compatible.
When `true`, the additional component state is included.

### Part 4: `WEBVIZ_EXPOSE` Macro (Controller Changes, One Line Per Field)

For truly internal controller state that isn't stored in any entity component
(FSM state, custom counters, algorithm-specific data), provide a one-line
registration macro:

```cpp
// In any controller's Init():
#include <webviz/webviz_expose.h>

void CFootBotSynchronization::Init(TConfigurationNode& t_node) {
    // ... existing init code ...
    WEBVIZ_EXPOSE(m_unCounter, "counter");
}
```

#### How It Works

`WEBVIZ_EXPOSE` registers a pointer + name in a global per-entity registry
(similar to how `viz_registry` works in Canopy, but generic):

```cpp
// webviz_expose.h
namespace webviz {
  struct ExposedField {
    std::string name;
    std::function<nlohmann::json()> getter;
  };

  inline std::unordered_map<std::string, std::vector<ExposedField>>& registry() {
    static std::unordered_map<std::string, std::vector<ExposedField>> reg;
    return reg;
  }
}

#define WEBVIZ_EXPOSE(member, name) \
  webviz::registry()[GetId()].push_back({ \
    name, [this]() -> nlohmann::json { return member; } \
  })
```

#### Generic User Functions

A single `CWebvizAutoExpose` user_functions class reads the registry and
serializes everything — no per-experiment subclass needed:

```cpp
class CWebvizAutoExpose : public CWebvizUserFunctions {
public:
  template <typename ENTITY>
  const nlohmann::json EntityData(ENTITY& c_entity) {
    auto it = webviz::registry().find(c_entity.GetId());
    if (it == webviz::registry().end()) return nullptr;
    nlohmann::json j;
    for (auto& field : it->second)
      j[field.name] = field.getter();
    return j;
  }
};
```

Usage in `.argos` XML — just reference the generic class:

```xml
<webviz port="3000">
  <user_functions label="webviz_auto_expose"
                  library="libwebviz_auto_expose" />
</webviz>
```

No custom user_functions class per experiment. Controllers register their
fields, the generic class serializes them.

## Key File References

| File | Current State | Change |
|---|---|---|
| `client-next/src/lib/computedFields.ts` | Does not exist | Create — computed field engine + 8 built-in fields |
| `client-next/src/lib/vizEngine.ts` | Discovers `user_data` fields only | Include computed fields in discovery |
| `client-next/src/lib/expressionParser.ts` | Does not exist | Create — safe expression evaluator |
| `client-next/src/ui/VizConfigPanel.tsx` | Field selectors for server fields | Add computed field section + expression editor |
| `client-next/src/stores/computedFieldStore.ts` | Does not exist | Create — user-defined field definitions (persisted) |
| `src/.../entity/webviz_footbot.cpp` | Sends position, orientation, LEDs, rays, points | Add wheel_speeds, gripper, turret, distance_scanner, battery |
| `src/.../entity/webviz_kheperaiv.cpp` | Sends position, orientation, LEDs, rays, points | Add wheel_speeds, battery, rab_data_size |
| `src/.../entity/webviz_leo.cpp` | Sends position, orientation, rays, points | Add battery, linear_velocity, angular_velocity |
| `src/.../webviz.h` | `m_bDeltaMode` flag | Add `m_bExtendedState` flag |
| `src/.../webviz_expose.h` | Does not exist | Create — `WEBVIZ_EXPOSE` macro + registry |
| `src/.../webviz_auto_expose.cpp` | Does not exist | Create — generic user_functions that reads registry |
| `docs/COMPUTED_FIELDS.md` | Does not exist | Create — guide for built-in + user-defined fields |
| `docs/WEBVIZ_EXPOSE.md` | Does not exist | Create — guide for controller state exposure |

## Assumptions

- [ ] Previous-frame entity state can be retained cheaply (already stored in `experimentStore` for delta mode)
- [ ] DBSCAN on 1000 entities runs in <16ms (one frame budget at 60fps)
- [ ] `WEBVIZ_EXPOSE` lambda captures are safe across ARGoS Reset() cycles (controller `this` pointer stable)
- [ ] A safe expression parser can be implemented in <200 lines without `eval`
- [ ] LED color strings are consistent across entity types (`"red"`, `"black"`, etc.)

## Dependencies

- **Requires**: None (Part 1 works standalone; Part 3 is independent)
- **Enhanced by**: PN-004 (computed fields appear in viz config presets)
- **Blocks**: None

## Open Questions

- Should computed fields run in a Web Worker to avoid blocking the render loop?
- Should `WEBVIZ_EXPOSE` support arrays and nested objects, or just scalars?
- Should the expression language support `prev.prev` (two frames back) for acceleration?
- How to handle `_cluster_id` parameters (ε, minPts) — global settings or per-field config?
- Should `WEBVIZ_EXPOSE` be opt-in per build (`-DWEBVIZ_EXPOSE=ON`) to avoid overhead when not using webviz?

## Done When

- [ ] `_speed`, `_heading`, `_led_state` computed fields appear in field selectors
- [ ] Color-by `_led_state` correctly visualizes synchronization experiment LED flashes
- [ ] Color-by `_speed` shows movement patterns in diffusion experiment
- [ ] User can define a custom expression field in the UI and use it for color-by
- [ ] `extended_state="true"` adds wheel_speeds, battery, gripper to footbot broadcast
- [ ] `extended_state="true"` adds wheel_speeds, battery to kheperaiv broadcast
- [ ] Client auto-discovers new fields (wheel_speeds, battery, etc.) without code changes
- [ ] `WEBVIZ_EXPOSE(m_unCounter, "counter")` in synchronization controller → `counter` appears in client field list
- [ ] Generic `webviz_auto_expose` user_functions works without per-experiment subclass
- [ ] Default `extended_state="false"` produces identical output to current serializers
- [ ] Documentation for all three mechanisms (computed fields, extended state, WEBVIZ_EXPOSE)

## Effort Estimate

| Component | Time |
|---|---|
| Computed field engine + 8 built-in fields | 2 hours |
| vizEngine integration (field discovery) | 30 min |
| Expression parser | 1.5 hours |
| Expression editor UI | 45 min |
| Extended entity serializers (footbot, kheperaiv, leo) | 1.5 hours |
| `extended_state` XML config flag | 15 min |
| `WEBVIZ_EXPOSE` macro + registry | 30 min |
| `webviz_auto_expose` generic user_functions | 45 min |
| Documentation | 30 min |
| Testing with sync/diffusion/flocking experiments | 45 min |
| **Total** | **~9 hours** |
