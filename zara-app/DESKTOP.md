# ZARA Windows Desktop

ZARA's Windows desktop wrapper uses Electron. The React/Vite interface and existing Express/SQLite backend remain the same application; the desktop main process starts the API on a dynamically selected loopback-only port and serves the built frontend from that local origin.

## Development

Use three terminals from `zara-app/`:

1. Start the API: `npm run server:dev`
2. Start Vite: `npm run dev -- --host 127.0.0.1`
3. Start the Electron shell: `npm run desktop:dev`

The desktop development shell loads Vite at `http://127.0.0.1:5173`. It does not start a second development API process.

## Build the Windows installer

Install dependencies after pulling the branch:

```bash
npm install
```

Create the Windows x64 installer:

```bash
npm run desktop:dist
```

The NSIS installer is written to `release/`. The backend is bundled separately from the frontend. SQLite data is stored in Electron's per-user application data directory, not beside the installed executable.

## GitHub Actions build

Open the repository's Actions tab, choose **Build ZARA Windows Installer**, and run the workflow manually. The resulting installer is uploaded as a workflow artifact for 14 days.

## Security model

- Electron renderer runs with context isolation, sandboxing, and Node integration disabled.
- The local API binds only to 127.0.0.1 on an available port.
- The SQLite database is stored in the current Windows user's Electron application data directory.
- The application does not grant unrestricted shell or filesystem access to the renderer.
- External HTTP(S) links open in the system browser; the app window cannot navigate away from its local origin.
- Provider keys remain blank by default and are not bundled into the installer.
- Do not expose the desktop app's local API port to another device or network.

## Current limitations

This first desktop wrapper packages the existing web assistant and local API. It does not yet provide native Windows automation, a Windows Credential Manager integration, a native microphone pipeline, or a signed installer. Those features require separate implementation and permission controls. Provider network requests still require privately configured credentials and reachable provider endpoints.
