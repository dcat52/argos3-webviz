# PN-019 Design: Entity Manipulation & Spawning

Parent proposal: [PN-019](../proposals/PN-019-entity-manipulation.md)

## Implementation Order

```
Infrastructure (command queue + delta removal) → Phase A (drag) → Phase B (spawn/delete) → Phase C (distribute)
```

Each phase is independently shippable. Infrastructure must land first.

---

## 0. Infrastructure

### 0a. Command Queue (C++)

**Problem:** WebSocket commands arrive on the uWS thread; entity mutations must run on the simulation thread.

**Design:** Mutex-protected vector of `std::function<void()>`, drained on the simulation thread.

```cpp
// webviz.h — add to CWebviz private members
std::mutex m_mtxCommandQueue;
std::vector<std::function<void()>> m_vecCommandQueue;

void EnqueueCommand(std::function<void()> fn);
void DrainCommandQueue();
```

```cpp
// webviz.cpp
void CWebviz::EnqueueCommand(std::function<void()> fn) {
  std::lock_guard<std::mutex> lock(m_mtxCommandQueue);
  m_vecCommandQueue.push_back(std::move(fn));
}

void CWebviz::DrainCommandQueue() {
  std::vector<std::function<void()>> vecCmds;
  {
    std::lock_guard<std::mutex> lock(m_mtxCommandQueue);
    vecCmds.swap(m_vecCommandQueue);
  }
  for (auto& fn : vecCmds) fn();
}
```

**Drain points:**
1. `SimulationThreadFunction()` — before `m_cSimulator.UpdateSpace()` in the playing/FF loop
2. `SimulationThreadFunction()` — in the paused sleep loop (every ~100ms)
3. `StepExperiment()` — before `m_cSimulator.UpdateSpace()` (runs on uWS thread, but simulation thread is sleeping when paused, so no race)

**Migrate existing commands:**
```cpp
// Before (direct call on uWS thread):
} else if (strCmd == "moveEntity") {
  MoveEntity(id, pos, orient);
}

// After (queued):
} else if (strCmd == "moveEntity") {
  EnqueueCommand([this, id, pos, orient]() {
    MoveEntity(id, pos, orient);
  });
}
```

### 0b. Delta Protocol Removal Detection

**Problem:** Delta encoding doesn't signal removed entities. Client retains stale entities until next keyframe.

**Server change** (`webviz.cpp` in `BroadcastExperimentState()`):

After the existing current-vs-prev diff loop, add:

```cpp
// Detect removed entities
nlohmann::json cRemoved = nlohmann::json::array();
for (auto& e : m_cPrevEntities) {
  const std::string& strId = e["id"].get<std::string>();
  bool bFound = false;
  for (auto& c : cCurrentEntities) {
    if (c["id"].get<std::string>() == strId) { bFound = true; break; }
  }
  if (!bFound) cRemoved.push_back(strId);
}
if (!cRemoved.empty()) {
  cStateJson["removed"] = cRemoved;
}
```

Note: The prev lookup is already built as `mapPrev`. Optimize by checking which prev IDs aren't in a set built from current:

```cpp
std::unordered_set<std::string> setCurrentIds;
for (auto& c : cCurrentEntities) setCurrentIds.insert(c["id"].get<std::string>());

nlohmann::json cRemoved = nlohmann::json::array();
for (auto& [id, _] : mapPrev) {
  if (setCurrentIds.find(id) == setCurrentIds.end()) cRemoved.push_back(id);
}
if (!cRemoved.empty()) cStateJson["removed"] = cRemoved;
```

**Protocol change** (`protocol.ts`):

```typescript
export interface DeltaMessage {
  type: 'delta'
  // ... existing fields ...
  removed?: string[]  // IDs of entities removed since last frame
}
```

**Client change** (`experimentStore.ts` in `applyDelta`):

```typescript
// After merging changed entities:
if (msg.removed) {
  for (const id of msg.removed) {
    next.delete(id)
  }
}
```

**Recorder change** (`webviz_recorder.cpp`): Same removal detection in `ComputeDelta()`.

---

## Phase A: Drag-to-Move (Client)

### Interaction Model

```
pointer-down on entity → enter drag mode → suppress camera → track pointer → pointer-up → send moveEntity → exit drag mode
```

### State

Add to `experimentStore.ts`:

```typescript
// New state
dragEntityId: string | null
dragStartPos: Vec3 | null

// New actions
startDrag: (id: string) => void
endDrag: () => void
updateDragPosition: (pos: Vec3) => void
```

### Ground Plane Raycasting

In `Scene.tsx`, add a `DragHandler` component inside the R3F `<Canvas>`:

```typescript
function DragHandler() {
  const { camera, raycaster, pointer } = useThree()
  const dragEntityId = useExperimentStore((s) => s.dragEntityId)
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), [])
  const intersection = useMemo(() => new THREE.Vector3(), [])

  // On pointer move during drag: raycast to ground plane
  const onPointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!dragEntityId) return
    e.stopPropagation()
    raycaster.setFromCamera(pointer, camera)
    raycaster.ray.intersectPlane(groundPlane, intersection)
    if (intersection) {
      useExperimentStore.getState().updateDragPosition({
        x: intersection.x, y: intersection.y, z: 0
      })
    }
  }, [dragEntityId])

  // On pointer up: send moveEntity, end drag
  const onPointerUp = useCallback(() => {
    if (!dragEntityId) return
    const entity = useExperimentStore.getState().entities.get(dragEntityId)
    if (!entity || !('position' in entity)) return
    useConnectionStore.getState().moveEntity(
      dragEntityId,
      entity.position,
      entity.orientation
    )
    useExperimentStore.getState().endDrag()
  }, [dragEntityId])

  return (
    <mesh visible={false} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
      <planeGeometry args={[1000, 1000]} />
    </mesh>
  )
}
```

### Camera Suppression

Export the `CameraControls` ref from `CameraController` via a store or context. During drag, set `ref.current.enabled = false`. On drag end, re-enable.

Simplest approach — add to `cameraStore`:

```typescript
cameraControlsRef: React.RefObject<CameraControlsImpl> | null
setCameraControlsRef: (ref: React.RefObject<CameraControlsImpl>) => void
```

In `startDrag`: `cameraStore.getState().cameraControlsRef?.current?.enabled = false`
In `endDrag`: `cameraStore.getState().cameraControlsRef?.current?.enabled = true`

### Optimistic Position Update

During drag, update the entity position locally in the store (without waiting for server confirmation):

```typescript
updateDragPosition: (pos) => {
  const { dragEntityId, entities } = get()
  if (!dragEntityId) return
  const entity = entities.get(dragEntityId)
  if (!entity || !('position' in entity)) return
  const next = new Map(entities)
  next.set(dragEntityId, { ...entity, position: pos } as AnyEntity)
  set({ entities: next })
}
```

The next server broadcast reconciles the position. If `MoveTo` failed (collision), the entity snaps back to its server-authoritative position.

### Entity Renderer Changes

Add `onPointerDown` to `EntityRendererProps` in `registry.ts`:

```typescript
export interface EntityRendererProps {
  entity: AnyEntity
  selected?: boolean
  onClick?: (e: ThreeEvent<MouseEvent>) => void
  onDoubleClick?: (e: ThreeEvent<MouseEvent>) => void
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void  // NEW
  overrideColor?: string
}
```

In `SceneEntities`, wire `onPointerDown` to start drag:

```typescript
onPointerDown={(e) => {
  e.stopPropagation()
  useExperimentStore.getState().startDrag(entity.id)
}}
```

Each renderer forwards `onPointerDown` to its root `<mesh>` or `<group>`.

---

## Phase B: Spawn & Delete

### New Protocol Types (`protocol.ts`)

```typescript
export interface AddEntityCommand {
  command: 'addEntity'
  type: 'box' | 'cylinder' | 'foot-bot' | 'kheperaiv' | 'light'
  id_prefix: string
  position: Vec3
  orientation: Quaternion
  // Type-specific params:
  controller?: string       // robots only
  size?: Vec3               // box only
  movable?: boolean         // box/cylinder (default: true)
  mass?: number             // box/cylinder (default: 1.0)
  radius?: number           // cylinder only
  height?: number           // cylinder only
  color?: string            // light only
}

export interface RemoveEntityCommand {
  command: 'removeEntity'
  entity_id: string
}

export interface MetadataRequest {
  command: 'getMetadata'
}

export interface MetadataMessage {
  type: 'metadata'
  controllers: string[]     // available controller IDs from .argos
  entity_types: string[]    // registered entity type strings
}
```

### C++ Command Handlers (`webviz.cpp`)

```cpp
} else if (strCmd == "addEntity") {
  // Capture params from JSON
  std::string strType = c_json_command["type"];
  std::string strPrefix = c_json_command["id_prefix"];
  CVector3 cPos(/* parse position */);
  CQuaternion cOrient(/* parse orientation */);

  EnqueueCommand([this, strType, strPrefix, cPos, cOrient, c_json_command]() {
    // Generate unique ID
    std::string strId = GenerateEntityId(strPrefix);

    CEntity* pcEntity = nullptr;
    if (strType == "box") {
      CVector3 cSize(/* parse or default 0.3,0.3,0.3 */);
      bool bMovable = c_json_command.value("movable", true);
      Real fMass = c_json_command.value("mass", 1.0);
      pcEntity = new CBoxEntity(strId, cPos, cOrient, bMovable, cSize, fMass);
    } else if (strType == "cylinder") {
      Real fRadius = c_json_command.value("radius", 0.15);
      Real fHeight = c_json_command.value("height", 0.5);
      bool bMovable = c_json_command.value("movable", true);
      Real fMass = c_json_command.value("mass", 1.0);
      pcEntity = new CCylinderEntity(strId, cPos, cOrient, bMovable, fRadius, fHeight, fMass);
    } else if (strType == "foot-bot") {
      std::string strCtrl = c_json_command["controller"];
      pcEntity = new CFootBotEntity(strId, strCtrl, cPos, cOrient);
    } else if (strType == "kheperaiv") {
      std::string strCtrl = c_json_command["controller"];
      pcEntity = new CKheperaIVEntity(strId, strCtrl, cPos, cOrient);
    }
    // ... light, leo

    if (pcEntity) {
      try {
        m_cSimulator.GetLoopFunctions().AddEntity(*pcEntity);
        LOG << "[INFO] Entity added: " << strId << '\n';
      } catch (CARGoSException& ex) {
        LOGERR << "[ERROR] Failed to add entity: " << ex.what() << '\n';
        delete pcEntity;
      }
    }
  });

} else if (strCmd == "removeEntity") {
  std::string strId = c_json_command["entity_id"];
  EnqueueCommand([this, strId]() {
    try {
      m_cSimulator.GetLoopFunctions().RemoveEntity(strId);
      LOG << "[INFO] Entity removed: " << strId << '\n';
    } catch (CARGoSException& ex) {
      LOGERR << "[ERROR] Failed to remove entity: " << ex.what() << '\n';
    }
  });

} else if (strCmd == "getMetadata") {
  // Respond immediately (read-only, no mutation)
  nlohmann::json cMeta;
  cMeta["type"] = "metadata";

  // Extract controller IDs from config
  TConfigurationNode& tRoot = m_cSimulator.GetConfigurationRoot();
  TConfigurationNode& tControllers = GetNode(GetNode(tRoot, "controllers"));
  TConfigurationNodeIterator itCtrl;
  for (itCtrl = itCtrl.begin(&tControllers); itCtrl != itCtrl.end(); ++itCtrl) {
    std::string strId;
    GetNodeAttribute(*itCtrl, "id", strId);
    cMeta["controllers"].push_back(strId);
  }

  // Entity types — hardcoded to what we have serializers for
  cMeta["entity_types"] = {"box", "cylinder", "foot-bot", "kheperaiv", "light"};

  m_cWebServer->SendToClient(str_ip, cMeta);
}
```

**ID generation helper:**

```cpp
std::string CWebviz::GenerateEntityId(const std::string& str_prefix) {
  UInt32 unIdx = 0;
  while (true) {
    std::string strCandidate = str_prefix + "_" + std::to_string(unIdx);
    try {
      m_cSpace.GetEntity(strCandidate);
      ++unIdx;  // exists, try next
    } catch (CARGoSException&) {
      return strCandidate;  // doesn't exist, use it
    }
  }
}
```

### Client Store (`connectionStore.ts`)

```typescript
addEntity: (params: AddEntityCommand) => get().send(params),
removeEntity: (id: string) => get().send({ command: 'removeEntity', entity_id: id }),
requestMetadata: () => get().send({ command: 'getMetadata' }),
```

### Client UI

**Spawn palette** — new component `client-next/src/ui/SpawnPalette.tsx`:
- Floating panel (reuse `FloatingPanel` from PN-013)
- Lists entity types from metadata
- Click type → enter placement mode
- For robots: controller dropdown populated from metadata
- For box/cylinder: size/radius/height inputs, movable toggle

**Placement mode** — when active:
- Cursor changes to crosshair
- Click on ground plane → send `addEntity` with click position
- ESC or right-click → cancel placement mode

**Delete** — right-click context menu on selected entity:
- "Delete" option → send `removeEntity`

### Metadata Store

New store `client-next/src/stores/metadataStore.ts`:

```typescript
interface MetadataState {
  controllers: string[]
  entityTypes: string[]
  applyMetadata: (msg: MetadataMessage) => void
}
```

Request metadata on WebSocket connect. Handle `metadata` message type in `connectionStore.onMessage`.

---

## Phase C: Distribute with Ghost Preview

### New Protocol Type

```typescript
export interface DistributeCommand {
  command: 'distribute'
  type: 'box' | 'cylinder' | 'foot-bot' | 'kheperaiv' | 'light'
  id_prefix: string
  quantity: number
  max_trials?: number        // default: 100
  position_method: 'uniform' | 'gaussian' | 'constant' | 'grid'
  position_params: {
    min?: Vec3               // uniform
    max?: Vec3               // uniform
    mean?: Vec3              // gaussian
    std_dev?: Vec3           // gaussian
    values?: Vec3            // constant
    center?: Vec3            // grid
    distances?: Vec3         // grid
    layout?: [number, number, number]  // grid
  }
  orientation_method: 'uniform' | 'gaussian' | 'constant'
  orientation_params: {
    min?: Vec3
    max?: Vec3
    mean?: Vec3
    std_dev?: Vec3
    values?: Vec3
  }
  // Type-specific params (same as AddEntityCommand)
  controller?: string
  size?: Vec3
  movable?: boolean
  mass?: number
  radius?: number
  height?: number
}
```

### C++ Handler

```cpp
} else if (strCmd == "distribute") {
  // Parse all params from JSON
  EnqueueCommand([this, /* captured params */]() {
    // Replicate CSpace::Distribute() logic:
    // 1. Create position/orientation generators based on method
    // 2. For each entity (0..quantity-1):
    //    a. Generate position + orientation
    //    b. Create entity via constructor
    //    c. AddEntity
    //    d. Check collision (IsCollidingWithSomething)
    //    e. If colliding: RemoveEntity, retry (up to max_trials)
    //    f. If not colliding: done
  });
}
```

### Client Ghost Preview

New file `client-next/src/lib/distribute.ts`:

```typescript
export type DistMethod = 'uniform' | 'gaussian' | 'constant' | 'grid'

export function generatePositions(
  method: DistMethod,
  params: DistributeCommand['position_params'],
  quantity: number,
  seed?: number
): Vec3[] {
  const rng = seedableRng(seed ?? Date.now())
  switch (method) {
    case 'uniform': return uniformPositions(rng, params.min!, params.max!, quantity)
    case 'gaussian': return gaussianPositions(rng, params.mean!, params.std_dev!, quantity)
    case 'constant': return Array(quantity).fill(params.values!)
    case 'grid': return gridPositions(params.center!, params.distances!, params.layout!, quantity)
  }
}

function uniformPositions(rng, min, max, n) {
  return Array.from({ length: n }, () => ({
    x: min.x + rng() * (max.x - min.x),
    y: min.y + rng() * (max.y - min.y),
    z: min.z + rng() * (max.z - min.z),
  }))
}

function gridPositions(center, distances, layout, n) {
  const [cols, rows, layers] = layout
  const positions: Vec3[] = []
  for (let l = 0; l < layers && positions.length < n; l++)
    for (let r = 0; r < rows && positions.length < n; r++)
      for (let c = 0; c < cols && positions.length < n; c++)
        positions.push({
          x: center.x + (c - (cols - 1) / 2) * distances.x,
          y: center.y + (r - (rows - 1) / 2) * distances.y,
          z: center.z + (l - (layers - 1) / 2) * distances.z,
        })
  return positions
}
```

### Ghost Rendering

New component `client-next/src/scene/GhostEntities.tsx`:

```typescript
function GhostEntities({ positions, entityType }: { positions: Vec3[], entityType: string }) {
  return (
    <group>
      {positions.map((pos, i) => (
        <EntityRenderer
          key={`ghost-${i}`}
          entity={{ type: entityType, id: `ghost_${i}`, position: pos, orientation: { x: 0, y: 0, z: 0, w: 1 } } as AnyEntity}
          overrideColor="rgba(100, 200, 255, 0.3)"
        />
      ))}
    </group>
  )
}
```

Note: For large quantities (50+), switch to instanced rendering for ghosts.

### Distribute Panel UI

New component `client-next/src/ui/DistributePanel.tsx`:
- Entity type selector
- Quantity slider (1-100)
- Method picker (uniform/gaussian/constant/grid)
- Method-specific param inputs (min/max for uniform, mean/std_dev for gaussian, etc.)
- Controller picker (for robots)
- Live ghost preview updates on every param change
- "Place" button → sends `distribute` command
- "Cancel" button → clears ghosts

---

## 6. User Function Lifecycle Hooks

### C++ Changes (`webviz_user_functions.h`)

Add virtual methods with empty defaults:

```cpp
virtual void EntitySelected(CEntity& c_entity) {}
virtual void EntityDeselected(CEntity& c_entity) {}
virtual void EntityMoved(CEntity& c_entity,
    const CVector3& c_old_pos, const CVector3& c_new_pos) {}
virtual void EntityRotated(CEntity& c_entity,
    const CQuaternion& c_old_orient, const CQuaternion& c_new_orient) {}
```

### Call Sites

All routed through the command queue to run on the simulation thread:

- `EntityMoved`: called inside the queued `MoveEntity` handler, before and after `MoveTo()`
- `EntitySelected`/`EntityDeselected`: new `selectEntity` command from client, queued
- `EntityRotated`: future — not implemented in Phase A (no rotation UI)

---

## File Summary

| File | Action | Phase |
|------|--------|-------|
| `src/.../webviz.h` | Add command queue members, `EnqueueCommand`, `DrainCommandQueue`, `GenerateEntityId` | Infra |
| `src/.../webviz.cpp` | Add queue drain points, migrate commands to queue, add `addEntity`/`removeEntity`/`distribute`/`getMetadata` handlers, delta removal detection | Infra + B + C |
| `src/.../webviz_user_functions.h` | Add lifecycle hook virtual methods | Hooks |
| `src/.../webviz_recorder.cpp` | Delta removal detection | Infra |
| `client-next/src/types/protocol.ts` | Add command types, `MetadataMessage`, `removed` field on `DeltaMessage` | Infra + B + C |
| `client-next/src/stores/experimentStore.ts` | Add drag state, handle `removed` in `applyDelta` | Infra + A |
| `client-next/src/stores/connectionStore.ts` | Add `addEntity`, `removeEntity`, `requestMetadata`, handle `metadata` message | B |
| `client-next/src/stores/metadataStore.ts` | New — controller/entity type metadata | B |
| `client-next/src/stores/cameraStore.ts` | Add `cameraControlsRef` | A |
| `client-next/src/scene/Scene.tsx` | Add `DragHandler`, wire `onPointerDown` on entities | A |
| `client-next/src/scene/CameraController.tsx` | Expose ref via store | A |
| `client-next/src/scene/GhostEntities.tsx` | New — ghost entity rendering | C |
| `client-next/src/entities/registry.ts` | Add `onPointerDown` to `EntityRendererProps` | A |
| `client-next/src/lib/distribute.ts` | New — distribution algorithms | C |
| `client-next/src/ui/SpawnPalette.tsx` | New — entity type picker + placement | B |
| `client-next/src/ui/DistributePanel.tsx` | New — distribute config + ghost preview | C |

---

## Design Critique Resolutions

### Critical

**D1. Ghost transparency — `overrideColor` rgba doesn't work with Three.js materials**
Three.js `Color` doesn't parse `rgba()` strings. `meshPhysicalMaterial` needs separate `opacity` + `transparent` props.
**Fix:** Add `ghost?: boolean` prop to `EntityRendererProps`. When true, renderers apply `transparent={true}`, `opacity={0.3}`, `color="#64C8FF"`. Simpler than splitting into color+opacity — one boolean covers the ghost use case.

**D2. `SendToClient` doesn't exist on `CWebServer`**
No unicast WebSocket send is exposed. Only `Broadcast()` exists.
**Fix:** Broadcast metadata to all clients. Metadata is small (~200 bytes) and static. Send on every new client connect (server can detect via uWS `open` handler) or on explicit `getMetadata` request via broadcast. Harmless for other clients to receive.

### Major

**D3. Instanced entities missing `onPointerDown` for drag**
Instanced foot-bot/kheperaiv meshes don't have `onPointerDown`. Drag can't start on them.
**Fix:** Add `onPointerDown` to `<instancedMesh>` in `InstancedGroup`, using `e.instanceId` to look up entity ID (same pattern as existing `onClick`). ~5 lines.

**D4. Invisible plane blocks events or doesn't receive them**
`visible={false}` meshes don't receive R3F pointer events. Visible transparent planes steal clicks from entities.
**Fix:** Remove the invisible mesh entirely. During drag, attach `pointermove` and `pointerup` listeners to the canvas DOM element. Use `THREE.Raycaster` + `THREE.Plane` for ground intersection directly in the handler. Clean up listeners on drag end.

**D5. `GenerateEntityId` uses exceptions for control flow**
O(n) with expensive exception construction per iteration.
**Fix:** Add `std::unordered_map<std::string, UInt32> m_mapNextEntityIdx` to `CWebviz`. On `addEntity`, look up `m_mapNextEntityIdx[prefix]++`. O(1). IDs are never reused (counter only increments).

**D6. Distribute partial failure semantics**
8 of 10 placed, 9th fails — what happens to the 8?
**Fix:** Keep-what-succeeded. Log warning with count. Broadcast response: `{ type: "distribute_result", placed: 8, failed: 2, entity_ids: [...] }`. Client sees placed entities via normal broadcast.

### Minor

**D7. Command queue drain timing in FF mode**
Drain happens once per broadcast cycle, not per inner FF step. Commands during FF have latency up to `ff_draw_frames_every` steps.
**Fix:** Acceptable. Document the latency. Optionally drain inside inner loop for lower latency.

**D8. Metadata loading state**
SpawnPalette shows empty list before metadata arrives.
**Fix:** Add `metadataLoaded: boolean` to `metadataStore`. SpawnPalette disabled until true.

**D9. StepExperiment races with simulation thread broadcast**
Pre-existing bug, not introduced by this design.
**Fix:** Out of scope. Document as known issue.

**D10. Background click deselection**
No way to deselect by clicking empty space.
**Fix:** Add `onPointerMissed={() => selectEntity(null)}` to `<Canvas>`. One line, include in Phase A.

---

## Revised DragHandler Design (replaces invisible mesh approach)

```typescript
function useDrag() {
  const canvasRef = useCanvasRef()
  const { camera } = useThree()
  const dragEntityId = useExperimentStore((s) => s.dragEntityId)
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), [])

  useEffect(() => {
    if (!dragEntityId || !canvasRef) return
    const canvas = canvasRef

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      )
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouse, camera)
      const hit = new THREE.Vector3()
      raycaster.ray.intersectPlane(groundPlane, hit)
      if (hit) {
        useExperimentStore.getState().updateDragPosition({ x: hit.x, y: hit.y, z: 0 })
      }
    }

    const onUp = () => {
      const entity = useExperimentStore.getState().entities.get(dragEntityId)
      if (entity && 'position' in entity) {
        useConnectionStore.getState().moveEntity(dragEntityId, entity.position, entity.orientation)
      }
      useExperimentStore.getState().endDrag()
    }

    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    return () => {
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
    }
  }, [dragEntityId, canvasRef, camera])
}
```

## Revised Ghost Entity Rendering

```typescript
// registry.ts — add ghost prop
export interface EntityRendererProps {
  entity: AnyEntity
  selected?: boolean
  ghost?: boolean              // NEW: semi-transparent preview
  onClick?: (e: ThreeEvent<MouseEvent>) => void
  onDoubleClick?: (e: ThreeEvent<MouseEvent>) => void
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void
  overrideColor?: string
}

// In each renderer, when ghost is true:
// <meshPhysicalMaterial color="#64C8FF" transparent opacity={0.3} depthWrite={false} />
```
