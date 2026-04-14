# Proposal: Delta Encoding Protocol

Created: 2026-04-13
Baseline Commit: `aa1ffd1` (`client-next`)
GitHub Issue: #2

## Status: 📋 INVESTIGATION
<!-- 📋 INVESTIGATION → 🔍 CRITIQUE → 🟡 DESIGN → 🔍 CRITIQUE → 🔵 IMPLEMENTATION → 🟣 VERIFICATION → ✅ COMPLETE / 🔴 ABANDONED -->

## Goal

Harden and extend the opt-in delta encoding protocol so broadcasts only
transmit entity fields that changed since the last frame. Reduce bandwidth
by 60-90% for large swarms where most robots are stationary on any given tick.

## Scope Boundary

**In scope:**
- Keyframe interval for late-joining clients
- Entity-level skip (omit unchanged entities entirely)
- Client capability negotiation on connect
- Protocol documentation

**Out of scope:**
- ❌ Binary encoding (MessagePack/CBOR) — separate proposal if JSON delta proves insufficient
- ❌ Changes to the recorder file format (see PN-003)
- ❌ Per-field compression or quantization of position values
- ❌ Benchmarking infrastructure — see note below

### Note: Benchmarking as Prerequisite

Before implementing these changes, we need a testing/benchmarking proposal
that establishes:
- Latency measurement framework (round-trip time, frame delivery jitter)
- Bandwidth measurement (bytes/frame, bytes/second at various entity counts)
- Regression test suite (ensure protocol changes don't break existing behavior)
- Baseline measurements with current full-broadcast mode

This benchmarking infrastructure is a **separate proposal** that should be
completed first so we can measure the actual improvement delta encoding provides
and catch regressions as we iterate.

## Current State

**What exists:**
- C++ side: `delta="true"` XML attribute on `<webviz>`, `m_bDeltaMode` flag in
  `webviz.h`, first broadcast sends `type=schema` with full state, subsequent
  broadcasts send `type=delta` with only changed fields
- Client side: `experimentStore.ts` has `applySchema()` and `applyDelta()` that
  merge changed fields into existing entity map
- Protocol types: `SchemaMessage` and `DeltaMessage` defined in `protocol.ts`
- Delta resets on experiment reset

**What's missing:**
- No keyframe interval — late-joining clients get nothing until next reset
- No entity-level skip — unchanged entities still appear in delta with empty diff
- No client negotiation — server decides encoding unilaterally
- No bandwidth or latency measurements
- Default is still full broadcast (`delta="false"`)

## Affected Components

- [x] C++ plugin (`src/`) — change tracking, keyframes, negotiation handler
- [x] Next client (`client-next/`) — protocol types, experiment store, connection handshake
- [x] Protocol / message format — keyframe message type, capability negotiation
- [ ] Legacy client (`client/`)
- [ ] Build system / CMake
- [x] Documentation — protocol spec

## Design

### Entity-Level Skip

Current delta includes every entity even if unchanged. Change to only include
entities with at least one modified field:

```cpp
// In broadcast loop
nlohmann::json entityDelta;
for (auto& [field, value] : currentEntity) {
    if (value != m_mapPrevState[entityId][field])
        entityDelta[field] = value;
}
if (!entityDelta.empty()) {
    delta["entities"][entityId] = entityDelta;
}
// If no entities changed, skip the broadcast entirely
```

### Keyframe Interval

Periodic full-state broadcast so late joiners can sync:

```xml
<webviz delta="true" keyframe_interval="100" />
```

- Every N steps, send a `type=schema` message instead of `type=delta`
- Also send schema immediately when a new client connects (requires tracking
  connection events from the WebSocket server)

### Client Capability Negotiation

On WebSocket connect, client sends:

```json
{ "type": "hello", "capabilities": ["broadcast", "schema", "delta"] }
```

Server responds with the encoding it will use. Clients that don't send `hello`
get full broadcasts (backwards compatible).

### Protocol Messages (Updated)

| Type | When | Content |
|---|---|---|
| `broadcast` | Default mode, every tick | Full entity state |
| `schema` | Delta mode, first frame + keyframes + new client | Full entity state |
| `delta` | Delta mode, between keyframes | Only changed entities/fields |

## Key File References

| File | Current State | Change |
|---|---|---|
| `src/.../webviz.h` | `m_bDeltaMode`, prev state map | Add `m_nKeyframeInterval`, connection tracking |
| `src/.../webviz.cpp` | Field-level diff in broadcast loop | Add entity-level skip, keyframe counter, hello handler |
| `src/.../webviz_webserver.h` | WebSocket server | Expose new-connection callback |
| `client-next/src/types/protocol.ts` | `SchemaMessage`, `DeltaMessage` | Add `HelloMessage`, `HelloResponse` |
| `client-next/src/protocol/connection.ts` | Auto-reconnect, no handshake | Send hello on connect, parse response |
| `client-next/src/stores/experimentStore.ts` | `applySchema()`, `applyDelta()` | No change needed |

## Assumptions

- [ ] Field-level JSON comparison (`!=`) is correct for all entity field types
- [ ] WebSocket server exposes a per-connection callback or event for new connections
- [ ] Keyframe interval of 100 steps is sufficient for typical join latency
- [ ] Entity-level skip doesn't break client-side rendering (entities not in delta retain previous state)

## Dependencies

- **Requires**: PN-006 (for baseline measurements and regression testing)
- **Enhanced by**: PN-001 (delta becomes default when client-next ships)
- **Blocks**: None

## Open Questions

- Should delta mode become the default once keyframes are implemented?
- Is gzip on the WebSocket frame sufficient, or do we need application-level compression?
- Should the keyframe interval be adaptive based on change rate?

## Done When

- [ ] Unchanged entities are omitted from delta messages
- [ ] Keyframe interval configurable via XML, sends schema every N steps
- [ ] New client connections receive immediate schema message
- [ ] Client sends hello with capabilities on connect
- [ ] Bandwidth reduction measured: >50% for 100+ stationary entities
- [ ] Late-joining client renders correctly without waiting for reset
- [ ] Backwards compatible: clients without hello still work

## Effort Estimate

| Component | Time |
|---|---|
| Entity-level skip in C++ | 30 min |
| Keyframe interval + new-client schema | 45 min |
| Client hello negotiation (C++ + TS) | 45 min |
| Protocol documentation | 15 min |
| **Total** | **~2 hours** |
(Excludes benchmarking — that's a separate proposal)
