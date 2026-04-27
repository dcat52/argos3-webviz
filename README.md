
<br/>
<p align="center" style="background:#edeff3;">
        <img width="80%" style="max-width:540px" src="client/images/banner_light.png" alt="Webviz banner">
</p>

<br/>
<p align="center">
    <a href="https://github.com/dcat52/argos3-webviz/actions/workflows/test.yml">
        <img src="https://github.com/dcat52/argos3-webviz/actions/workflows/test.yml/badge.svg" alt="Tests">
    </a>
    <a href="https://github.com/dcat52/argos3-webviz/blob/master/LICENSE" target="_blank">
        <img src="https://img.shields.io/github/license/dcat52/argos3-webviz.svg" alt="GitHub license">
    </a>
    <img src="https://img.shields.io/github/last-commit/dcat52/argos3-webviz" alt="GitHub last commit" />
</p>
<br/>

# ARGoS3-Webviz

A web-based visualization and interaction plugin for [ARGoS 3](https://www.argos-sim.info/). Replaces the QT-OpenGL viewer with a browser UI — connect from any machine on the network, no native GUI required.

The project has two parts:

- **C++ plugin** (`src/`) — ARGoS visualization module that streams simulation state over WebSockets
- **React client** (`client-next/`) — modern 3D viewer built with React, Three.js / React Three Fiber, and TypeScript

## Features

**3D Visualization**
- Real-time 3D rendering of all standard ARGoS entities (foot-bot, Khepera IV, Leo, box, cylinder, light)
- LED rendering, sensor ray visualization, draw primitives from loop functions
- Configurable render tiers (full detail → simplified → points) for large swarms
- Orthographic and perspective camera modes with FOV control
- Fit-to-arena viewport on load

**Interaction**
- Entity selection, inspection panel with live data
- Entity dragging (Ctrl+click-drag), spawning (click-to-place with drag-to-aim), deletion
- Keyboard shortcuts for common actions

**Simulation Control**
- Play / pause / step / fast-forward with configurable speed multipliers
- Timeline scrubber with keyframe-cached seek
- Recording and replay

**Data & Protocol**
- Delta encoding for bandwidth-efficient updates
- Computed fields and controller state exposure
- User data display with configurable filtering via `.argos` config
- Multi-experiment dashboard
- Floating, resizable panels

**Infrastructure**
- All communication over WebSockets (single port, NAT/Docker friendly)
- SSL support (`wss://`)
- UWebSockets backend (epoll on Linux, kqueue on macOS)

## Quick Start

### C++ Plugin

Install dependencies, then build:

```console
# Debian/Ubuntu
$ sudo apt install cmake git zlib1g-dev libssl-dev

# macOS
$ brew install cmake git zlib openssl
```

```console
$ git clone https://github.com/dcat52/argos3-webviz
$ cd argos3-webviz
$ mkdir build && cd build
$ cmake -DCMAKE_BUILD_TYPE=Release ../src
$ make
$ sudo make install
```

### Web Client

```console
$ cd client-next
$ npm install
$ npm run mock       # start mock WebSocket server (no ARGoS needed)
$ npm run dev        # start Vite dev server → http://localhost:5173
```

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for the full development guide, stack details, and proposal workflow.

## Documentation

- [Basic usage and configuration](docs/basic_usage.md)
- [Sending data from server to client](docs/sending_data_from_server.md)
- [Sending data from client to server](docs/sending_data_from_client.md)
- [Custom entity: server side](docs/custom_entity_serverside.md)
- [Custom entity: client side](docs/custom_entity_clientside.md)
- [Writing a custom client](docs/writing_custom_client.md)
- [Contributing](docs/CONTRIBUTING.md)

## Limitations

- Entity rotation handles not yet implemented (QT-OpenGL has these)
- Floor texture rendering from loop functions is partial
- OpenGL loop functions are QT-specific and not applicable to the web client

## License

[MIT](https://choosealicense.com/licenses/mit/)

---

> **Fork notice:** This is a development fork of [NESTLab/argos3-webviz](https://github.com/NESTLab/argos3-webviz). Do not push to upstream. Any upstream contributions are a manual process.
