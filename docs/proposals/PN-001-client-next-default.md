# Proposal: Client-Next CMake Build & Install

Created: 2026-04-13
Baseline Commit: `aa1ffd1` (`client-next`)
GitHub Issue: N/A <!-- #N once published -->

## Status: 📋 INVESTIGATION
<!-- 📋 INVESTIGATION → 🔍 CRITIQUE → 🟡 DESIGN → 🔍 CRITIQUE → 🔵 IMPLEMENTATION → 🟣 VERIFICATION → ✅ COMPLETE / 🔴 ABANDONED -->

## Goal

Set up the CMake build and install targets so `client-next` is built and
distributed as the default web client. This branch is the working copy — the
legacy client on the upstream repo is untouched.

## Scope Boundary

**In scope:**
- CMake target to build `client-next/dist/` via `npm run build`
- Install target to place dist output in the plugin's static file directory
- C++ plugin configuration to serve client-next files
- Production Vite build config (base path, output structure)

**Out of scope:**
- ❌ Legacy client deprecation or removal (upstream concern, not this branch)
- ❌ Legacy client compatibility or feature parity audit
- ❌ New client-next features (separate proposals)
- ❌ CI/CD pipeline (future work)

## Current State

**What exists:**
- `client-next/` — fully functional Vite + React app, `npm run dev` works
- `client-next/vite.config.ts` — dev-oriented config with path aliases
- C++ plugin (`webviz_webserver.cpp`) serves static files from a configured directory
- CMake build system in `src/CMakeLists.txt` builds C++ plugin only

**What's missing:**
- No CMake target for client-next build
- No install target for dist output
- `vite.config.ts` may need `base` path adjustment for production
- C++ plugin defaults to `client/` directory — needs to point to client-next dist

## Affected Components

- [x] C++ plugin (`src/`) — static file serving path
- [x] Next client (`client-next/`) — production build config
- [x] Build system / CMake — new targets
- [x] Documentation — build instructions
- [ ] Legacy client (`client/`)
- [ ] Protocol / message format

## Design

### CMake Target

```cmake
find_program(NPM_EXECUTABLE npm)

if(NPM_EXECUTABLE)
  add_custom_target(client-next ALL
    COMMAND ${NPM_EXECUTABLE} ci --prefix ${CMAKE_SOURCE_DIR}/../client-next
    COMMAND ${NPM_EXECUTABLE} run build --prefix ${CMAKE_SOURCE_DIR}/../client-next
    COMMENT "Building client-next web client"
  )

  install(DIRECTORY ${CMAKE_SOURCE_DIR}/../client-next/dist/
          DESTINATION share/argos3/plugins/simulator/visualizations/webviz/client)
else()
  message(WARNING "npm not found — client-next will not be built. "
                  "Install Node.js to build the web client.")
endif()
```

Key decisions:
- `npm ci` (not `npm install`) for reproducible builds
- `ALL` target so it builds with `make` by default
- Graceful fallback if npm isn't available — just a warning, C++ plugin still builds
- Install to the same path the plugin already looks for static files

### Vite Production Config

Ensure `vite.config.ts` sets `base: './'` so assets use relative paths
(works when served from any directory):

```typescript
export default defineConfig({
  base: './',
  // ... existing config
})
```

### C++ Plugin Path

Update `webviz_webserver.cpp` to look for client files in the installed
location. The XML config already supports a path attribute — just change
the default:

```xml
<webviz port="3000" />
<!-- Plugin looks for client files in install prefix automatically -->
```

## Key File References

| File | Current State | Change |
|---|---|---|
| `src/CMakeLists.txt` | Builds C++ plugin only | Add client-next build + install targets |
| `client-next/vite.config.ts` | Dev config with aliases | Add `base: './'` for production |
| `src/.../webviz_webserver.cpp` | Serves from `client/` | Default to installed client-next path |
| `README.md` | References legacy client | Update build instructions |

## Assumptions

- [ ] `npm ci && npm run build` produces a self-contained `dist/` (index.html + hashed JS/CSS)
- [ ] Vite output with `base: './'` works when served by the C++ static file server
- [ ] Node.js/npm is available on developer machines (not required for end users if dist is pre-built)

## Dependencies

- **Requires**: None
- **Enhanced by**: All other proposals (they add features to what gets built)
- **Blocks**: None

## Open Questions

- Should `dist/` be committed to the repo for users without Node.js?
- Or should GitHub Releases include pre-built client assets?
- Minimum Node version: 18 LTS or 22?

## Done When

- [ ] `cmake --build .` builds both C++ plugin and client-next
- [ ] `sudo make install` places client-next dist in the correct directory
- [ ] C++ plugin serves client-next by default after install
- [ ] Build succeeds with a warning (not error) when npm is not available
- [ ] README updated with build instructions

## Effort Estimate

| Component | Time |
|---|---|
| CMake targets | 30 min |
| Vite production config | 15 min |
| C++ plugin default path | 15 min |
| Test full build + install flow | 30 min |
| README update | 15 min |
| **Total** | **~2 hours** |
