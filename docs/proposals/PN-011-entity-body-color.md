# Proposal: Entity Body Color Support

Created: 2026-04-19
GitHub Issue: #22

## Status: ✅ COMPLETE

## Goal

Add configurable body color to box and cylinder entities so all
visualizations (QT-OpenGL, webviz) render consistent, aesthetic colors
from a single source of truth in the ARGoS data model.

## Scope Boundary

**In scope:**
- Body color attribute on CBoxEntity and CCylinderEntity
- XML `color` attribute parsing with defaults
- QT-OpenGL renderer reads entity color instead of hardcoding
- Webviz serializer broadcasts color field
- Client-next renderers use broadcast color with fallbacks

**Out of scope:**
- ❌ Alpha/transparency support (future work)
- ❌ Robot entity colors (foot-bot, khepera, etc.)
- ❌ Color themes or palettes

## Design

### Approach

Add `m_cBodyColor` member to box and cylinder entity classes with
`GetBodyColor()` / `SetBodyColor()` accessors. Parse optional `color`
XML attribute in `Init()` with aesthetic defaults based on entity type
and movability. All renderers read from the entity instead of hardcoding.

### Defaults

| Entity | Movable | Non-movable |
|--------|---------|-------------|
| Box | `#4488cc` bright blue | `#37649b` deep blue |
| Cylinder | `#44aa88` teal | `#377864` deep teal |

Walls can be overridden to gray via XML: `color="gray60"`

### XML Usage

```xml
<box id="wall" size="4,0.1,0.5" movable="false" color="gray60">
<box id="obstacle" size="0.3,0.3,0.5" movable="true">  <!-- uses default -->
<cylinder id="post" radius="0.1" height="0.5" movable="false" color="yellow">
```

## Key File References

| File | Change |
|------|--------|
| `argos3: box_entity.h/.cpp` | Added m_cBodyColor, GetBodyColor(), SetBodyColor(), XML parsing |
| `argos3: cylinder_entity.h/.cpp` | Same |
| `argos3: qtopengl_box.cpp` | Reads GetBodyColor() instead of MOVABLE_COLOR/NONMOVABLE_COLOR |
| `argos3: qtopengl_cylinder.cpp` | Same |
| `webviz: webviz_box.cpp` | Serializes color as hex string |
| `webviz: webviz_cylinder.cpp` | Same |
| `webviz: BoxRenderer.tsx` | Uses broadcast color, fallback to defaults |
| `webviz: CylinderRenderer.tsx` | Same |

## Dependencies

- **Requires**: dcat52/argos3 (body color on master)
- **Enhanced by**: None
- **Blocks**: None

## Done When

- [x] Box and cylinder entities have configurable body color
- [x] QT-OpenGL reads from entity instead of hardcoding
- [x] Webviz broadcasts color field
- [x] Client-next renders broadcast color
- [x] Backward compatible — no XML change required for existing experiments

## Changelog

| Date | Change |
|------|--------|
| 2026-04-19 | Implementation complete, PR #23 merged |
