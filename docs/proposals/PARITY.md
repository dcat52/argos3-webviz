# QT-OpenGL Parity Tracking

Items needed to match QT-OpenGL functionality that don't yet have proposals.

## Entity Dragging

QT-OpenGL supports clicking and dragging entities to reposition them. The
legacy webviz client sends `moveEntity` commands. Client-next has the protocol
type defined (`MoveEntityCommand` in `protocol.ts`) but no UI for it.

**What's needed:**
- Click-and-drag on entities in the 3D viewport
- Raycasting to determine drag plane (ground plane or entity height)
- Send `moveEntity` command with new position/orientation on drag end
- Visual feedback during drag (ghost position or highlight)

**QT-OpenGL hooks this maps to:**
- `EntitySelected()`, `EntityDeselected()`, `EntityMoved()`, `EntityRotated()`

**Effort estimate:** ~2-3 hours (raycasting + drag handler + command sending)

**Status:** Not yet a proposal. Will become one when prioritized.
