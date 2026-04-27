# PN-029: Draw Functions Auto-Wiring — Design Doc

## Overview

Wire `CWebvizDrawFunctions` into the broadcast loop so draw commands and floor data automatically appear in WebSocket messages.

## Changes

### 1. `webviz_draw_functions.h` — Add sendUserData override + SetFloorChanged + dirty tracking

```cpp
// Add to public section:
const nlohmann::json sendUserData() override;

/** Mark floor as needing re-sample next tick */
void SetFloorChanged() { m_bFloorDirty = true; }

// Change m_bFloorDirty default:
// Already true — first tick always samples. After that, only when dirty.
```

### 2. `webviz_draw_functions.cpp` — Implement sendUserData

```cpp
const nlohmann::json CWebvizDrawFunctions::sendUserData() {
  nlohmann::json result;

  // Draw commands (populated by PreBroadcast → DrawInWorld)
  auto draws = GetDrawCommands();
  if (!draws.empty()) result["_draw"] = std::move(draws);

  // Floor data (populated by PreBroadcast → SampleFloor)
  auto floor = GetFloorData();
  if (!floor.is_null()) result["_floor"] = std::move(floor);

  return result;
}
```

### 3. `webviz_draw_functions.cpp` — Add dirty tracking to PreBroadcast/SampleFloor

```cpp
void CWebvizDrawFunctions::PreBroadcast(
    const CVector3& c_arena_size, const CVector3& c_arena_center) {
  m_vecWorldDraws.clear();
  DrawInWorld();
  if (m_bFloorDirty) {
    SampleFloor(c_arena_size, c_arena_center);
    m_bFloorDirty = false;
  }
}
```

### 4. `webviz.cpp` — Call PreBroadcast before sendUserData

In `BroadcastExperimentState()`, before the existing `sendUserData()` call:

```cpp
/************* Draw functions pre-broadcast *************/
auto* pcDrawFunctions =
  dynamic_cast<Webviz::CWebvizDrawFunctions*>(m_pcUserFunctions);
if (pcDrawFunctions != nullptr) {
  pcDrawFunctions->PreBroadcast(cArenaSize, cArenaCenter);
}
```

This must go **after** the arena size/center variables are computed but **before** `sendUserData()` is called. The existing code computes arena at ~line 922. The `sendUserData()` call is at ~line 914. So we need to reorder slightly: move the arena computation before the user_data block, then insert the PreBroadcast call.

### 5. `webviz.cpp` — Reorder: arena before user_data

Current order:
1. user_data = sendUserData()
2. arena size/center computed

New order:
1. arena size/center computed
2. PreBroadcast(arena) if draw functions
3. user_data = sendUserData()

### 6. `webviz.h` — Add include

```cpp
#include "webviz_draw_functions.h"
```

## Data Flow

```
BroadcastExperimentState():
  compute arena size/center
  ↓
  dynamic_cast to CWebvizDrawFunctions?
  ↓ yes
  PreBroadcast(arena_size, arena_center)
    → DrawInWorld()        → populates m_vecWorldDraws
    → SampleFloor() if dirty → populates m_vecFloorColors
  ↓
  sendUserData()
    → CWebvizDrawFunctions::sendUserData()
      → GetDrawCommands() → returns + clears m_vecWorldDraws as _draw
      → GetFloorData()    → returns m_vecFloorColors as _floor
    → result merged into cStateJson["user_data"]
  ↓
  Broadcast to clients
```

## Backwards Compatibility

- If user functions extend `CWebvizUserFunctions` (not draw): `dynamic_cast` returns null, no PreBroadcast call, `sendUserData()` works as before.
- If user functions extend `CWebvizDrawFunctions` but don't override `DrawInWorld()` or `GetFloorColor()`: empty draws, white floor — no visible change.
- `_draw` and `_floor` keys only appear when there's actual data.
