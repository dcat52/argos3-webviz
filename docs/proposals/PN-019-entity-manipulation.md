# Proposal: Entity Manipulation & Spawning

Created: 2026-04-21
Baseline Commit: `b77a8d9` (`master`)
GitHub Issue: N/A

## Status: 🔵 IMPLEMENTATION
<!-- 📋 INVESTIGATION → 🔍 CRITIQUE → 🟡 DESIGN → 🔍 CRITIQUE → 🔵 IMPLEMENTATION → 🟣 VERIFICATION → ✅ COMPLETE / 🔴 ABANDONED -->

## Goal

Add interactive entity manipulation to the webviz client: drag-to-move existing entities, spawn new entities (individually or via distributions), delete entities, and link robots to controllers. This brings webviz to parity with QT-OpenGL's entity interaction and goes beyond it with distribution previews and a spawn UI.

## Scope Boundary

**In scope:**
- Drag-to-move entities in the 3D viewport
- Spawn individual entities (box, cylinder, foot-bot, kheperaiv, light)
- Delete entities
- Distribute entities (uniform, gaussian, grid) with ghost preview
- Controller assignment for robots (from pre-defined controllers in .argos file)
- Server metadata endpoint (available entity types + controller IDs)
- Entity lifecycle hooks on `CWebvizUserFunctions` (EntitySelected, EntityMoved, etc.)

**Out of scope:**
- ❌ Defining new controllers at runtime (ARGoS3 architecture constraint)
- ❌ Spiri entity (no server-side serializer exists)
- ❌ Custom distribution methods beyond the 4 ARGoS3 supports
- ❌ Multi-select (useful but independent — separate proposal)
- ❌ Undo/redo system
- ❌ Entity rotation UI (move only; rotation is a future enhancement)

## Current State

**What exists:**

Server (C++ plugin):
- `CWebviz::MoveEntity()` handles `moveEntity` command — collision-aware via `CEmbodiedEntity::MoveTo()`
- `CWebviz` inherits `m_cSimulator` and `m_cSpace` from `CVisualization`
- `m_cSimulator.GetLoopFunctions()` provides `AddEntity()` and `RemoveEntity()`
- Entity serializers (`webviz_box.cpp`, `webviz_footbot.cpp`, etc.) send type, id, position, orientation, is_movable, scale/size, color, leds, rays, points
- `CWebvizUserFunctions::HandleCommandFromClient()` is the escape hatch for unknown commands
- No `addEntity`, `removeEntity`, or metadata commands exist

Protocol:
- `MoveEntityCommand` type defined in `protocol.ts`
- `CustomCommand` escape hatch exists
- No `AddEntityCommand`, `RemoveEntityCommand`, `DistributeCommand`, or metadata message types

Client stores:
- `connectionStore.moveEntity()` sends move commands over WebSocket
- `experimentStore` has single-entity selection (`selectedEntityId`), no drag state
- No spawn/delete actions

Client UI:
- Entity selection via single-click on renderers (all renderers forward `onClick`)
- Double-click fly-to via `cameraStore`
- `SelectionRing` visual on selected entity
- `CameraControls` (orbit/pan/zoom) always active — conflicts with drag
- No pointer event handlers beyond click
- `EntityRendererProps` interface: `entity`, `selected?`, `onClick?`, `onDoubleClick?`, `overrideColor?`
- Instanced rendering for foot-bot/kheperaiv (selected entity pulled out for individual rendering)

**What's missing:**
- Server command handlers for add/remove/distribute
- Server metadata endpoint for available controllers and entity types
- Protocol types for new commands
- Client drag interaction (pointer events, ground plane raycasting, camera suppression)
- Client spawn UI (entity palette, placement mode, controller picker)
- Client distribute UI (method picker, bounds, quantity, ghost preview)
- Entity lifecycle hooks on `CWebvizUserFunctions`

## ARGoS3 Capabilities (Investigation Findings)

### Entity Creation — Programmatic Constructors

All entity types support direct construction without XML:

```cpp
// Box — 6 params
new CBoxEntity(id, position, orientation, movable, size, mass);

// Cylinder — 7 params
new CCylinderEntity(id, position, orientation, movable, radius, height, mass);

// Foot-bot — 4 params (+ optional rab_range, etc.)
new CFootBotEntity(id, controller_id, position, orientation);

// KheperaIV — similar to foot-bot
new CKheperaIVEntity(id, controller_id, position, orientation);
```

The constructors handle full component setup: embodied entity, LEDs, wheels, sensors, actuators, controller assignment via `CControllableEntity::SetController()`.

### Entity Lifecycle — AddEntity / RemoveEntity

```cpp
// Spawn — 2 lines
auto* pc = new CFootBotEntity("fb_new", "fdc", CVector3(1,2,0), CQuaternion());
m_cSimulator.GetLoopFunctions().AddEntity(*pc);

// Delete — 1 line
m_cSimulator.GetLoopFunctions().RemoveEntity("fb_new");
```

`AddEntity` triggers `REGISTER_STANDARD_SPACE_OPERATIONS_ON_COMPOSABLE` which recursively:
1. Registers root entity in space maps/vectors
2. Registers embodied entity + assigns to physics engine
3. Registers controllable entity in controllable entities vector
4. Registers LEDs, sensors, etc.

`RemoveEntity` reverses the process, tearing down all components.

### Controller Assignment

- `CControllableEntity::SetController(str_controller_id)` looks up controller config from `CSimulator::GetConfigForController(str_id)`
- Creates controller, actuators, sensors from the XML `<controllers>` section
- **Constraint:** Controllers must be pre-defined in the `.argos` file. Cannot define new controllers at runtime.
- Available controller IDs can be extracted by walking `m_cSimulator.GetConfigurationRoot()` → `<controllers>` children → `id` attributes

### Distribute System

ARGoS3 supports 4 distribution methods:

| Method | Params | Behavior |
|--------|--------|----------|
| `uniform` | `min`, `max` (Vec3) | Random per axis within bounds |
| `gaussian` | `mean`, `std_dev` (Vec3) | Normal distribution per axis |
| `constant` | `values` (Vec3) | Fixed position for all |
| `grid` | `center`, `distances`, `layout` | Deterministic grid, no retry on collision |

The distribute algorithm: for each entity, generate position → create entity → add to space → check collision → retry if colliding (up to `max_trials`). Grid method cannot retry.

`CSpace::Distribute()` is private (init-time only), but the underlying primitives (factory + constructor + AddEntity + collision check) are all available individually. The position generation algorithms are simple math we can replicate client-side for ghost previews.

### QT-OpenGL Parity — User Function Hooks

QT-OpenGL user functions have entity lifecycle hooks that webviz lacks:

| QT-OpenGL Hook | Webviz Equivalent |
|---|---|
| `EntitySelected(CEntity&)` | ❌ None |
| `EntityDeselected(CEntity&)` | ❌ None |
| `EntityMoved(CEntity&, old_pos, new_pos)` | ❌ None |
| `EntityRotated(CEntity&, old_orient, new_orient)` | ❌ None |

These are non-breaking additions (empty default implementations).

## Affected Components

- [x] C++ plugin (`src/`) — new command handlers, metadata endpoint, user function hooks
- [ ] Legacy client (`client/`)
- [x] Next client (`client-next/`) — drag, spawn UI, distribute UI, protocol types, stores
- [x] Protocol / message format — new command types, metadata message
- [ ] Build system / CMake
- [x] Documentation

## Design

See [`docs/designs/PN-019-entity-manipulation.md`](../designs/PN-019-entity-manipulation.md) for the detailed implementation spec.

### Approach (Preliminary)

Three implementation phases, each independently useful:

**Phase A — Drag to Move (~3h)**
Client-only. Raycast against ground plane on pointer-down, track pointer-move, send `moveEntity` on pointer-up. Suppress `CameraControls` during drag. Optimistic local position update for visual feedback.

**Phase B — Spawn & Delete (~5h)**
C++ command handlers + protocol types + client UI. New `addEntity` command constructs entity via programmatic constructor and calls `AddEntity()`. New `removeEntity` command calls `RemoveEntity()`. New metadata message sends available entity types and controller IDs. Client gets entity palette panel and right-click delete.

**Phase C — Distribute with Ghost Preview (~4h)**
Client-side distribution algorithm (uniform/gaussian/grid) generates preview positions. Renders semi-transparent ghost entities. User adjusts params (method, quantity, bounds) and sees preview update in real-time. "Commit" sends batch `addEntity` commands (or a single `distribute` command that the server handles atomically with collision retry).

### Key Decisions

1. **Programmatic constructors over XML building** — entity types are known at compile time, constructors handle full setup, no conversion layer needed
2. **`CLoopFunctions::AddEntity/RemoveEntity` as the API** — this is the intended ARGoS3 API for runtime entity manipulation, handles all space registration recursively
3. **Ghost preview is client-side math** — distribution algorithms are simple (uniform random, gaussian, grid), no server round-trip needed for preview
4. **Camera suppression via ref toggle** — `CameraControls.enabled = false` during drag, re-enable on release
5. **Entity lifecycle hooks are non-breaking additions** — empty default implementations on `CWebvizUserFunctions`, called from command handlers

### Design Doc

`docs/designs/PN-019-entity-manipulation.md` — to be created in DESIGN phase

## Key File References

| File | Current State | Change |
|---|---|---|
| `src/plugins/.../webviz.cpp` | Handles `moveEntity` command | Add `addEntity`, `removeEntity`, `distribute`, `getMetadata` handlers |
| `src/plugins/.../webviz.h` | CWebviz class definition | Add new method declarations |
| `src/plugins/.../webviz_user_functions.h` | No entity lifecycle hooks | Add EntitySelected/Deselected/Moved/Rotated virtual methods |
| `client-next/src/types/protocol.ts` | `MoveEntityCommand` only | Add `AddEntityCommand`, `RemoveEntityCommand`, `DistributeCommand`, `MetadataMessage` |
| `client-next/src/stores/connectionStore.ts` | `moveEntity()` only | Add `addEntity()`, `removeEntity()`, `distribute()`, `requestMetadata()` |
| `client-next/src/stores/experimentStore.ts` | No drag state | Add `isDragging`, `dragEntityId`, `dragOffset` |
| `client-next/src/scene/Scene.tsx` | Click handlers only | Add pointer event handlers, drag state machine, ground plane raycasting |
| `client-next/src/scene/CameraController.tsx` | Always-active camera controls | Toggle `enabled` during drag via ref |
| `client-next/src/entities/registry.ts` | `EntityRendererProps` has click only | Add `onPointerDown?`, `onPointerUp?` |
| `client-next/src/ui/` | No spawn/distribute UI | New: EntityPalette, DistributePanel, ControllerPicker components |

## Assumptions

Verify these before starting. If any are false, revisit the design.

- [x] `CLoopFunctions::AddEntity()` works at runtime (not just init-time) — **confirmed** via source analysis
- [x] Programmatic constructors set up full entity (physics, controller, sensors) — **confirmed** via `CFootBotEntity` constructor source
- [x] `CControllableEntity::SetController()` works with pre-defined controller IDs — **confirmed** via source
- [x] `CWebviz` has access to `m_cSimulator.GetLoopFunctions()` — **confirmed** via `CVisualization` base class
- [ ] `AddEntity` is thread-safe when called from the websocket handler thread (may need to queue for simulation thread)
- [ ] Physics engine volume always contains the arena area (placement won't fail for positions within arena bounds)
- [ ] `RemoveEntity` during simulation doesn't cause dangling references in other entities' sensor readings

## Dependencies

- **Requires**: None
- **Enhanced by**: PN-020 (Entity LED Rendering — spawned boxes/cylinders would show LEDs)
- **Blocks**: None

## Done When

- [ ] Drag-to-move: click-drag an entity in the viewport → entity moves → server confirms new position
- [ ] Spawn: select entity type from palette → click ground to place → entity appears in simulation
- [ ] Spawn robot: select foot-bot → pick controller from dropdown → place → robot runs controller
- [ ] Delete: right-click entity → delete → entity removed from simulation
- [ ] Distribute: configure type/quantity/method/bounds → see ghost preview → commit → entities appear
- [ ] Ghost preview: adjusting distribute params updates ghost positions in real-time without server round-trip
- [ ] Metadata: client receives available entity types and controller IDs from server on connect
- [ ] Camera controls don't interfere with entity dragging
- [ ] Existing entity selection, fly-to, and rendering still work
- [ ] User function hooks: EntityMoved called when entity is dragged

## Verification Strategy

### Success Criteria
- Spawn 10 foot-bots via distribute → all run their controller → visible in viewport
- Drag a movable box to a new position → box stays at new position after release
- Delete an entity → entity disappears from viewport and simulation
- Ghost preview shows correct positions for uniform/grid distributions

### Regression Checks
- Existing entity rendering unchanged
- Camera orbit/pan/zoom works when not dragging
- Entity selection (click) and fly-to (double-click) still work
- Recording/replay unaffected
- Delta protocol encoding handles entity additions/removals

### Test Plan
| Test | Type | Procedure | Expected Result |
|------|------|-----------|-----------------|
| Drag movable box | Functional | Click-drag box entity | Box follows cursor, snaps to ground plane, server confirms |
| Drag immovable wall | Functional | Click-drag wall entity | Drag rejected or not initiated (walls are not movable) |
| Spawn box | Functional | Select box from palette, click ground | Box appears at click position |
| Spawn foot-bot with controller | Functional | Select foot-bot, pick controller, click ground | Robot appears and starts running controller |
| Delete entity | Functional | Right-click entity, select delete | Entity removed from simulation |
| Distribute uniform | Functional | Configure 10 boxes, uniform, commit | 10 boxes appear within bounds |
| Ghost preview | Visual | Open distribute panel, adjust quantity slider | Ghost entities update in real-time |
| Camera during drag | Functional | Drag entity while camera was orbiting | Camera stops orbiting during drag, resumes after |
| Collision on spawn | Functional | Spawn entity at occupied position | Server rejects or retries placement |

### Acceptance Threshold
- All functional tests pass
- No regressions in existing entity interaction
- Ghost preview renders at 60fps for up to 100 entities

## Open Questions

### Resolved Questions

1. ~~**Thread safety**~~ **Critical — command queue required.** `HandleCommandFromClient()` runs on the uWS event loop thread. `SimulationThreadFunction()` runs on a separate thread calling `UpdateSpace()` which iterates entity vectors. `AddEntity`/`RemoveEntity` mutate those containers → iterator invalidation → crash. The existing `MoveEntity` has the same latent race but gets away with it because `MoveTo()` is a quick in-place mutation. **Resolution:** Implement a mutex-protected command queue. Commands enqueued from the uWS thread, drained on the simulation thread before `UpdateSpace()`. Also drain during paused sleep loop (every ~100ms). Move existing `MoveEntity` to the queue too. `StepExperiment()` must drain the queue before stepping. Add ~2h to estimate.

2. ~~**Distribute: server-side or client-side?**~~ **Both.** Client generates approximate ghost preview using JS RNG (not shared-seed — ARGoS3's Mersenne Twister is impractical to replicate exactly in JS, and collision retries diverge the sequence). Server executes the actual distribute with collision retry. Ghost preview is labeled as approximate. Grid distributions are exact (deterministic, no RNG). After commit, real entities appear via normal broadcast and ghosts disappear.

3. ~~**Entity ID generation**~~ **Server generates, client provides prefix.** Client sends `id_prefix: "red_team"`, server creates `red_team_0` through `red_team_N`. Matches ARGoS3's existing `base_id + number` pattern from `<distribute>`. For single spawns, server picks next available number for the prefix. Avoids collision risk, keeps client simple.

4. ~~**Movability check**~~ **Allow dragging any entity.** Matches QT-OpenGL behavior. The `is_movable` flag affects physics (collision checking in `MoveTo`), not whether the user can attempt a drag. If `MoveTo` returns false (collision), the entity snaps back.

5. ~~**Leo entity**~~ **External plugin** (`argos3-leo` repo, like `argos3-kheperaiv`). Constructor pattern should match other robots. Webviz already has `webviz_leo.cpp` serializer and `LeoRenderer.tsx`. Will verify constructor during implementation and include in spawn palette if available.

## Critique Resolutions

Issues found during 🔍 CRITIQUE phase and their resolutions:

### Critical

**C1. Thread safety — command queue infrastructure (blocking)**
Entity mutations from the websocket thread will crash due to iterator invalidation on STL containers being iterated by the simulation thread. Resolution: mutex-protected command queue, drained on simulation thread before `UpdateSpace()` and during paused sleep. Existing `MoveEntity` also moved to queue. +2h to estimate.

**C2. Delta protocol doesn't detect removed entities (blocking)**
`BroadcastExperimentState()` delta computation iterates current entities vs previous, but never checks for IDs in previous that are absent from current. Removed entities persist as ghost state on the client until the next keyframe. Resolution: After the current-vs-prev loop, iterate `mapPrev` and emit removal signals for missing IDs. Client `applyDelta` deletes those entries. Same fix in `webviz_recorder.cpp`. +1h to estimate.

### Major

**C3. Effort estimate too low**
Realistic estimate is ~20h including command queue infrastructure, delta fix, and testing. Resolution: Accept revised estimate. Phases remain independently shippable — Phase A (drag) can land first.

**C4. Ghost preview RNG fidelity**
Shared-seed approach is architecturally unsound — ARGoS3's MT19937 + Box-Muller is impractical to replicate exactly in JS, and collision retries diverge the sequence. Resolution: Client preview is approximate (labeled as such). Grid distributions are exact. Server is authoritative for final positions.

**C5. User function hooks called from wrong thread**
Hooks would run on the uWS thread, racing with simulation state. Resolution: Route hooks through the command queue (same as C1). Hooks fire on the simulation thread between steps, matching QT-OpenGL semantics. Slight delay (up to one tick) is acceptable.

**C6. Recorder delta mode doesn't handle removal**
Same root cause as C2. Resolution: Same fix applied to `webviz_recorder.cpp`'s `ComputeDelta()`.

### Minor

**C7. No error handling for out-of-bounds placement**
If user clicks outside arena, entity spawns without physics body. Resolution: Clamp spawn positions to arena bounds on client side. Server-side: check `GetPhysicsModelsNum() > 0` after `AddEntity`, remove and return error if zero.

**C8. Experiment state constraint**
Resolution: Allow spawn/delete in all states. Command queue makes this safe — mutations execute between steps. `StepExperiment()` drains queue before stepping.

**C9. Missing entity type details**
Resolution: Add light entity to spawn palette (verify constructor). Explicitly exclude floor entity. Add movable/immovable toggle for box/cylinder. Document Leo as best-effort.

**C10. StepExperiment threading inconsistency**
Resolution: `StepExperiment()` drains the command queue before calling `UpdateSpace()`, on the websocket thread. This is safe because the simulation thread is sleeping when paused (the only state where step is valid).

## Effort Estimate

**Time:** ~20 FTE-hours (Infrastructure: 3h, Phase A: 3h, Phase B: 7h, Phase C: 4h, Testing: 3h)

**Change Footprint:**

| Metric | Estimate |
|--------|----------|
| Files created | ~6 (UI components, distribute logic) |
| Files modified | ~12 (C++ handlers, protocol, stores, scene, camera, registry) |
| Lines added/changed | ~800-1000 |
| Complexity | High — spans C++ server, protocol, and client UI with real-time interaction |

## Related Proposals

| Idea | Discovered During | Status |
|------|------------------|--------|
| PN-020: Entity LED Rendering (Box/Cylinder) | Investigation | Proposal created |
| CWebvizUserFunctions parity with QT-OpenGL hooks | Investigation | Included in this proposal |
| Entity rotation UI (drag-rotate) | Investigation | Future — separate proposal |
| Multi-select (shift-click, box select) | Investigation | Future — separate proposal |
| Snap-to-grid during placement | Investigation | Future — could be added to this proposal |

## Changelog

| Date | Change | Phase |
|------|--------|-------|
| 2026-04-21 | Initial investigation — ARGoS3 API analysis, client audit, UX ideas | 📋 INVESTIGATION |
| 2026-04-21 | Critique: found 10 issues (2 critical, 4 major, 4 minor). Thread safety requires command queue infrastructure. Delta protocol doesn't handle entity removal. Ghost preview RNG replication dropped in favor of approximate preview. Effort revised to ~20h. All issues resolved. | 🔍 CRITIQUE |
| 2026-04-21 | Design doc written: command queue, delta removal, drag-to-move, spawn/delete, distribute with ghost preview, user function hooks. Implementation order: Infra → A → B → C. | 🟡 DESIGN |
| 2026-04-21 | Design critique: 10 issues (2 critical, 4 major, 4 minor). Fixed ghost transparency (ghost prop instead of rgba), SendToClient (broadcast metadata), instanced drag (add onPointerDown to InstancedGroup), invisible plane (use DOM events + raycaster), ID generation (counter map), distribute atomicity (keep-what-succeeded + response). All resolved. | 🔍 CRITIQUE |
