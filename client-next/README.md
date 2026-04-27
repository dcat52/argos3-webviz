# ARGoS3-Webviz Client

Modern web client for ARGoS3-Webviz. Renders the simulation in 3D, provides entity interaction, and displays live experiment data — all in the browser.

## Stack

- **Vite 5** — build and dev server
- **React 19** + **TypeScript** (strict)
- **React Three Fiber** + **Drei** — 3D rendering
- **Zustand** — state management
- **Tailwind v4** — styling
- **Vitest** — unit tests
- **Playwright** — integration tests

## Development

```console
$ npm install
$ npm run dev          # Vite dev server → http://localhost:5173
```

### Mock Server

Run without ARGoS using the built-in mock WebSocket server:

```console
$ npm run mock         # default scenario
$ npm run mock:swarm   # swarm scenario
$ npm run mock:stress  # stress test (many entities)
$ npm run mock:delta   # delta encoding mode
```

See `package.json` for all mock scenarios.

### Testing

```console
$ npm test                # unit tests (vitest)
$ npm run test:watch      # unit tests in watch mode
$ npm run test:integration  # integration tests (playwright)
```

### Build

```console
$ npm run build        # type-check + production build
$ npm run preview      # preview production build
```

## Project Structure

```
src/
  components/ui/   Reusable UI primitives
  dashboard/       Multi-experiment dashboard
  entities/        Entity renderers (register in renderers/index.ts)
  hooks/           Custom React hooks
  mock/            Mock WebSocket server
  protocol/        WebSocket message handling
  scene/           Three.js scene setup
  stores/          Zustand stores (one per concern)
  types/           TypeScript type definitions
  ui/              Application UI (toolbar, panels, sidebar)
  ui/panels/       Floating panel components
```

## Contributing

See [docs/CONTRIBUTING.md](../docs/CONTRIBUTING.md) for conventions, branch naming, proposal workflow, and style guides.
