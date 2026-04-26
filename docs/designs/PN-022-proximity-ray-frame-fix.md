# Design: PN-022 Proximity Ray Coordinate Frame Fix

## Overview

Fix the ray-to-local coordinate transformation in entity serializers by using
pre-physics entity poses instead of post-physics poses. The fix is entirely
server-side (C++ plugin), requires no protocol or client changes.

## Critique Findings

Investigation confirmed. Additional findings from critique:

1. **Intersection points have the same bug** — `vecPoints` are also subtracted
   from post-physics `cPosition` in all three serializers. Must fix these too.
2. **Orientation matters** — the `cInvZRotation` used for ray rotation is also
   derived from post-physics orientation. Must use pre-physics orientation.
3. **Fast-forward loop** — calls `UpdateSpace()` N times, broadcasts once.
   Snapshot must be taken before each `UpdateSpace()` call (last snapshot wins).
4. **Recorder** — does NOT serialize rays. Out of scope.
5. **Entity IDs** — `c_entity.GetId()` returns `std::string`. Stable within a step.

## Changes

### File 1: `src/plugins/simulator/visualizations/webviz/webviz.h`

Add a public struct and getter, plus a private member and method.

```cpp
// After line 42 (after the REGISTER_WEBVIZ_ENTITY_OPERATION macro), before the
// closing namespace brace:

// ADD: nothing here — the struct goes inside the class definition.
```

```cpp
// Inside class CWebviz, in the public section (after line 85, after Destroy()):

    /** Pre-physics entity pose for correct ray-to-local transformation */
    struct SEntityPose {
      CVector3 Position;
      CQuaternion Orientation;
    };

    /** Get the pre-physics pose map (for entity serializers) */
    const std::unordered_map<std::string, SEntityPose>&
      GetPrePhysicsPoses() const { return m_mapPrePhysicsPoses; }
```

```cpp
// In the private section (after m_mapNextEntityIdx, before
// SimulationThreadFunction):

    /** Pre-physics entity poses, snapshotted before UpdateSpace() */
    std::unordered_map<std::string, SEntityPose> m_mapPrePhysicsPoses;

    /** Snapshot entity poses before physics step */
    void SnapshotPrePhysicsPoses();
```

### File 2: `src/plugins/simulator/visualizations/webviz/webviz.cpp`

Add the snapshot implementation and call it before every `UpdateSpace()`.

```cpp
// NEW METHOD — add before BroadcastExperimentState() definition (before line 772):

  void CWebviz::SnapshotPrePhysicsPoses() {
    m_mapPrePhysicsPoses.clear();
    CEntity::TVector& vecEntities = m_cSpace.GetRootEntityVector();
    for (auto* pcEntity : vecEntities) {
      auto* pcComposable = dynamic_cast<CComposableEntity*>(pcEntity);
      if (pcComposable != nullptr &&
          pcComposable->HasComponent("body") &&
          pcComposable->HasComponent("controller")) {
        auto& cEmbodied = pcComposable->GetComponent<CEmbodiedEntity>("body");
        const auto& cAnchor = cEmbodied.GetOriginAnchor();
        m_mapPrePhysicsPoses[pcEntity->GetId()] = {
          cAnchor.Position, cAnchor.Orientation};
      }
    }
  }
```

```cpp
// CALL SITE 1: Play/fast-forward loop (line ~210)
// BEFORE:
          m_cSimulator.UpdateSpace();
// AFTER:
          SnapshotPrePhysicsPoses();
          m_cSimulator.UpdateSpace();
```

```cpp
// CALL SITE 2: StepExperiment() (line ~685)
// BEFORE:
      m_cSimulator.UpdateSpace();
// AFTER:
      SnapshotPrePhysicsPoses();
      m_cSimulator.UpdateSpace();
```

### File 3: `src/plugins/simulator/visualizations/webviz/entity/webviz_footbot.cpp`

Replace the ray/point transformation to use pre-physics pose.

```cpp
// REPLACE the ray transformation section.
// OLD (lines 79-82):
        CQuaternion cInvZRotation = cOrientation;
        cInvZRotation.SetZ(-cOrientation.GetZ());

// NEW:
        /* Use pre-physics pose for ray transform (rays were computed before
         * physics stepped, so they're in the old coordinate frame) */
        const auto& mapPoses = c_webviz.GetPrePhysicsPoses();
        auto itPose = mapPoses.find(c_entity.GetId());
        const CVector3& cRayPosition =
          (itPose != mapPoses.end()) ? itPose->second.Position : cPosition;
        const CQuaternion& cRayOrientation =
          (itPose != mapPoses.end()) ? itPose->second.Orientation : cOrientation;

        CQuaternion cInvZRotation = cRayOrientation;
        cInvZRotation.SetZ(-cRayOrientation.GetZ());
```

```cpp
// REPLACE ray subtraction (lines 98-101):
// OLD:
          CVector3 cStartVec = vecRays[i].second.GetStart();
          cStartVec -= cPosition;
          CVector3 cEndVec = vecRays[i].second.GetEnd();
          cEndVec -= cPosition;

// NEW:
          CVector3 cStartVec = vecRays[i].second.GetStart();
          cStartVec -= cRayPosition;
          CVector3 cEndVec = vecRays[i].second.GetEnd();
          cEndVec -= cRayPosition;
```

```cpp
// REPLACE intersection point subtraction (line 124):
// OLD:
          cPoint -= cPosition;

// NEW:
          cPoint -= cRayPosition;
```

### File 4: `src/plugins/simulator/visualizations/webviz/entity/webviz_kheperaiv.cpp`

Identical pattern to footbot. Same three changes:

1. Replace `cInvZRotation` derivation (lines 99-100) with pose lookup + `cRayPosition`/`cRayOrientation`
2. Replace `cStartVec -= cPosition` / `cEndVec -= cPosition` (lines 117-119) with `cRayPosition`
3. Replace `cPoint -= cPosition` (line 141) with `cRayPosition`

### File 5: `src/plugins/simulator/visualizations/webviz/entity/webviz_leo.cpp`

Identical pattern. Same three changes:

1. Replace `cInvZRotation` derivation (lines 78-79) with pose lookup + `cRayPosition`/`cRayOrientation`
2. Replace `cStartVec -= cPosition` / `cEndVec -= cPosition` (lines 96-98) with `cRayPosition`
3. Replace `cPoint -= cPosition` (line 120) with `cRayPosition`

## Edge Cases

| Case | Handling |
|------|----------|
| Entity added mid-step (no snapshot) | Fallback to current position (existing behavior) |
| Entity with no controller | Not snapshotted, no rays to transform |
| Stationary entity | Pre-physics == post-physics, zero difference |
| Fast-forward N steps | Snapshot before each `UpdateSpace()`, last one wins |
| Entity removed mid-step | Stale snapshot entry ignored (entity won't be serialized) |

## What This Does NOT Fix

- Draw-function rays (`CWebvizDrawFunctions::DrawRay`) — these are user-specified
  world-coordinate rays, not sensor rays. They don't go through the entity serializer.
- The recorder — it doesn't serialize rays.

## Thread Safety Note

`StepExperiment()` runs on the webserver thread (via `HandleCommandFromClient`),
not the simulation thread. This means `SnapshotPrePhysicsPoses()` writes to
`m_mapPrePhysicsPoses` on the webserver thread while the simulation thread's
paused-state `BroadcastExperimentState()` could read it via serializers.

This is a pre-existing architectural issue — `StepExperiment` already races with
the simulation thread on shared state like `m_cPrevEntities`. The snapshot map
doesn't make it categorically worse. A proper fix would require mutex protection
across all shared state in `StepExperiment`, which is out of scope for this proposal.

## Design Critique Resolutions

| # | Issue | Resolution |
|---|-------|------------|
| 1 | Guard must check `"body"` before `GetComponent("body")` | Added `HasComponent("body")` to guard |
| 2 | Thread safety: `StepExperiment` on webserver thread | Documented as pre-existing issue |
| 3 | Line number inaccuracies | Corrected to 85, 772 |
