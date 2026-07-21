## Basic Usage

### 1. Add webviz to your experiment

Edit your `.argos` experiment file and replace the visualization tag:

```xml
<visualization>
    <webviz />
    <!-- <qt-opengl /> -->
</visualization>
```

Then run as usual:

```console
$ argos3 -c your_experiment.argos
```

The server starts on port 3000 by default.

### 2. Open the web client

The modern client lives in `client-next/`. To run it:

```console
$ cd client-next
$ npm install
$ npm run dev
```

Open **http://localhost:5173** in your browser. It auto-connects to `ws://localhost:3000`.

To use without a live ARGoS instance:

```console
$ npm run mock    # starts a mock WebSocket server with simulated entities
$ npm run dev     # in another terminal
```

### 3. Production build

```console
$ cd client-next
$ npm run build          # outputs to client-next/dist/
$ npx vite preview       # serve the built files
```

For remote access, serve with `--host 0.0.0.0`:

```console
$ npx vite preview --host 0.0.0.0 --port 5173
```

The client auto-detects the server hostname from `window.location.hostname`.

---

## XML Configuration

### Minimal

```xml
<visualization>
    <webviz />
</visualization>
```

### All options with defaults

```xml
<visualization>
    <webviz port="3000"
            broadcast_frequency="10"
            ff_draw_frames_every="2"
            autoplay="false"
            delta="false"
            keyframe_interval="100"
            real_time_factor="1.0"
            extended_state="false"
            send_entity_data="true"
            send_global_data="true"
            entity_data_fields=""
            ssl_key_file=""
            ssl_cert_file=""
            ssl_ca_file=""
            ssl_dh_params_file=""
            ssl_cert_passphrase=""
    />
</visualization>
```

### Parameter reference

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `port` | unsigned short | 3000 | WebSocket and HTTP port. Range: [1, 65535]. Ports < 1024 need root. |
| `broadcast_frequency` | unsigned short | 10 | Broadcast rate in Hz. Range: [1, 1000]. |
| `ff_draw_frames_every` | unsigned short | 2 | Steps to skip per broadcast in fast-forward mode. |
| `autoplay` | bool | false | Start the experiment automatically on launch. |
| `delta` | bool | false | Enable delta encoding — only send changed entity fields. Reduces bandwidth. |
| `keyframe_interval` | unsigned int | 100 | In delta mode, send a full schema every N steps. |
| `real_time_factor` | float | 1.0 | Speed multiplier. 1.0 = real-time, 2.0 = 2× speed, 0 = unlimited. |
| `extended_state` | bool | false | Include extra entity state (wheel speeds, battery, gripper). |
| `send_entity_data` | bool | true | Include per-entity `user_data` in broadcasts. |
| `send_global_data` | bool | true | Include global `user_data` in broadcasts. |
| `entity_data_fields` | string | "" | Comma-separated whitelist of per-entity user_data fields. Empty = send all. |

### User functions

```xml
<visualization>
    <webviz port="3000">
        <user_functions label="my_webviz_functions"
                        library="build/libMyWebvizFunctions" />
    </webviz>
</visualization>
```

See [User Functions](USER_FUNCTIONS.md) for the full guide.

### SSL

```xml
<webviz port="3000"
        ssl_key_file="/path/to/key.pem"
        ssl_cert_file="/path/to/cert.pem"
        ssl_ca_file="/path/to/ca.pem"
        ssl_dh_params_file="/path/to/dhparams.pem"
        ssl_cert_passphrase="your_passphrase" />
```

Requires webviz compiled with OpenSSL support.
