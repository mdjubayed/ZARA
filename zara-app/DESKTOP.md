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
- The only native app launch actions currently exposed are Notepad and Calculator. Each requires a confirmation dialog; arbitrary commands and app-closing actions are not exposed.
- The Files screen can open one user-selected UTF-8 text/source file (maximum 500 KB) and save text through a native Save As dialog. The save path is selected by the user and a separate confirmation is required before writing. File deletion, bulk access, and arbitrary filesystem traversal are not exposed.
- Native file operations are limited to `.txt`, `.md`, `.json`, `.csv`, common source-code, markup, stylesheet, log, YAML, TOML, and SQL text formats; the app rejects binary/non-UTF-8 files and hidden or common secret/credential filenames.
- External HTTP(S) links open in the system browser; the app window cannot navigate away from its local origin.
- Provider keys remain blank by default and are not bundled into the installer.
- In the packaged Windows app, users can enter keys in Brain Settings. Electron `safeStorage` encrypts them with the Windows DPAPI-backed provider before writing them to the user's application-data directory. The frontend receives only a saved/not-saved status, never the saved key.
- The secure-key UI is intentionally unavailable in the browser and in the development Electron shell; those environments continue to use private backend environment variables.
- Do not expose the desktop app's local API port to another device or network.

## Current limitations

This first desktop wrapper packages the existing web assistant and local API. It provides confirmed Notepad/Calculator launching, default-browser opening, and restricted user-selected text file open/save. It does not provide general Windows automation, a Windows Credential Manager integration, or a signed installer. Those features require separate implementation and permission controls. Provider network requests still require privately configured credentials and reachable provider endpoints.
