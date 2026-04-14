# Proposal: Leo Entity Renderer

Created: 2026-04-13
Baseline Commit: `aa1ffd1` (`client-next`)
GitHub Issue: N/A <!-- #N once published -->

## Status: 📋 INVESTIGATION
<!-- 📋 INVESTIGATION → 🔍 CRITIQUE → 🟡 DESIGN → 🔍 CRITIQUE → 🔵 IMPLEMENTATION → 🟣 VERIFICATION → ✅ COMPLETE / 🔴 ABANDONED -->

## Goal

Add a `LeoRenderer.tsx` to client-next so Leo robot entities render correctly
instead of falling through to `DefaultEntity`.

## Scope Boundary

**In scope:**
- `LeoRenderer.tsx` component with appropriate geometry
- Registration in entity renderer registry
- Correct rendering of Leo-specific broadcast fields

**Out of scope:**
- ❌ Leo-specific visualization features (separate from 004/005)
- ❌ Changes to the C++ Leo serializer (separate from 005)
- ❌ URDF/mesh model loading

## Current State

**What exists:**
- C++ serializer `webviz_leo.cpp` — sends `type: "Leo"`, position, orientation,
  rays, points (no LEDs — Leo has no `CLEDEquippedEntity`)
- `LeoEntity` type defined in `client-next/src/types/protocol.ts`
- `DefaultEntity.tsx` renders a gray sphere fallback for unknown types
- Leo physical dimensions: body radius 0.30m (from `CLeoEntity` source)

**What's missing:**
- No `LeoRenderer.tsx` in `client-next/src/entities/renderers/`
- Not registered in `client-next/src/entities/renderers/index.ts`

## Affected Components

- [x] Next client (`client-next/`) — new renderer component
- [ ] C++ plugin (`src/`)
- [ ] Protocol / message format
- [ ] Build system / CMake
- [ ] Documentation

## Design

Leo is a differential-drive ground robot with a cylindrical body (radius 0.30m).
Unlike FootBot/KheperaIV, it has no LEDs and no turret. The renderer should be
a simple cylinder with a direction indicator.

```tsx
// src/entities/renderers/LeoRenderer.tsx
export function LeoRenderer({ entity, overrideColor }: EntityRendererProps) {
  const color = overrideColor ?? '#5a6e5a'
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[0.30, 0.30, 0.12, 24]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Direction indicator */}
      <mesh position={[0.20, 0.07, 0]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#333" />
      </mesh>
    </group>
  )
}
```

## Key File References

| File | Current State | Change |
|---|---|---|
| `client-next/src/entities/renderers/LeoRenderer.tsx` | Does not exist | Create |
| `client-next/src/entities/renderers/index.ts` | Registers 6 renderers | Add Leo |

## Assumptions

- [ ] Leo body radius of 0.30m is correct (from `CLeoEntity` source)
- [ ] A simple cylinder is sufficient (no need for detailed mesh model)

## Dependencies

- **Requires**: None
- **Enhanced by**: PN-005 (Leo velocity fields once serializer is extended)
- **Blocks**: None

## Done When

- [ ] Leo entities render as a green-gray cylinder with direction indicator
- [ ] `overrideColor` prop works for viz system color-by
- [ ] DefaultEntity fallback no longer used for Leo type

## Effort Estimate

| Component | Time |
|---|---|
| LeoRenderer.tsx + registry | 20 min |
| **Total** | **~20 min** |
