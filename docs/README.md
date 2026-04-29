# Documentation

## Getting Started
- [Basic usage and configuration](basic_usage.md) — XML config, running the client, all parameters
- [Controlling the experiment](controlling_experiment.md) — play, pause, step, speed, entity manipulation, distribute

## User Functions (C++)
- [User functions guide](USER_FUNCTIONS.md) — complete guide for external projects
- [Sending data from server to client](sending_data_from_server.md) — `sendUserData()`, per-entity data
- [Sending data from client to server](sending_data_from_client.md) — `HandleCommandFromClient()`
- [Draw functions](DRAW_FUNCTIONS.md) — porting QT-OpenGL draw calls to webviz
- [UI controls](UI_CONTROLS.md) — custom buttons, sliders, toggles from loop functions
- [WEBVIZ_EXPOSE](WEBVIZ_EXPOSE.md) — one-line macro for exposing controller state
- [Computed fields](COMPUTED_FIELDS.md) — client-side derived fields (_speed, _heading, etc.)
- [Viz hints](VIZ_HINTS.md) — server-side hints for default visualization config

## Protocol
- [Writing a custom client](writing_custom_client.md) — WebSocket protocol, message types, entity formats
- [File format (.argosrec)](FILE_FORMAT.md) — recording file structure
- [Benchmarks](BENCHMARKS.md) — performance baselines

## Extending
- [Custom entity: server side](custom_entity_serverside.md) — C++ JSON serializer
- [Custom entity: client side](custom_entity_clientside.md) — React Three Fiber renderer

## Developing
- [Developing webviz](developing_webviz.md) — project structure, architecture, dev workflow
- [Contributing](CONTRIBUTING.md) — proposal process, branch naming, PR conventions

## Proposals
- [Proposal index](proposals/README.md) — active proposals, dependency graph
- [QT-OpenGL parity](proposals/PARITY.md) — feature gap tracking
- [Design documents](designs/) — detailed specs for code-heavy proposals
