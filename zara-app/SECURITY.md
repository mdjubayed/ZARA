# ZARA Security Notes

## Provider credentials

- OmniRoute and FreeLLMAPI credentials are read only from backend environment variables.
- The frontend never receives provider credentials.
- Provider secrets must not be stored in SQLite settings or provider configuration records.
- The `.env` file is ignored by Git, but local environment files are still plaintext files on disk. Prefer Codespaces/host secret injection for deployed environments and protect local workspace access.
- Database startup removes unsupported legacy provider rows, clears provider config blobs, and removes secret-like keys from legacy settings.

## Network boundary

- The ZARA API listens on `127.0.0.1` only.
- In development, the Vite server proxies `/api` requests to the loopback API.
- Do not expose or forward the API port or provider ports to untrusted networks.
- Production deployments must use a trusted reverse proxy, HTTPS, and an explicit CORS allowlist.

## User data

- Conversation history and user-saved memories are stored in the local SQLite database.
- Saved memory notes are included in later provider requests as bounded context. Users can review and delete saved notes in the Memory screen.
- Browser speech recognition may process audio using the browser vendor's online service. The app sends the resulting transcript to the selected AI provider.

## Workspace file access

- The user must explicitly select a folder through the browser File System Access API.
- ZARA lists a bounded number of files and reads supported text/source files only.
- File saves overwrite only the selected file and require a confirmation prompt.
- The web app does not offer file deletion, shell execution, or unrestricted filesystem access.
- The Windows Electron renderer has no Node integration and uses a sandboxed, context-isolated preload bridge.
- The preload bridge exposes only an allowlist for opening Notepad/Calculator and opening validated HTTP(S) links in the system browser. Each UI action requires explicit confirmation; arbitrary command execution is not exposed.

## Current security boundary

This is a local-first web application foundation, not a multi-user internet service. It does not yet include account login or multi-user authorization. Keep the backend loopback-only and do not deploy it as a public service without adding authentication, authorization, rate limiting, and deployment-specific secret management.

## Reporting

Do not paste provider keys, passwords, private files, or other credentials into GitHub issues, pull requests, screenshots, or ChatGPT.