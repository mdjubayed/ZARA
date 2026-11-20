# ZARA Security Notes

## Provider credentials

- OmniRoute and FreeLLMAPI credentials are read from backend environment variables or the packaged Windows desktop secure-storage bridge.
- The frontend never receives provider credentials.
- Provider secrets must not be stored in SQLite settings or provider configuration records.
- The packaged Windows desktop app stores provider keys in a separate encrypted file using Electron `safeStorage` with Windows DPAPI. The renderer never reads the saved key back; it receives only configured/not-configured status.
- Windows DPAPI protects data for the current Windows user account. It is not protection against malware or other code already running as that same user.
- The `.env` file is ignored by Git, but local environment files are still plaintext files on disk. Prefer Codespaces/host secret injection for deployed environments and protect local workspace access.
- Database startup removes unsupported legacy provider rows, clears provider config blobs, and removes secret-like keys from legacy settings.

## Network boundary

- The ZARA API listens on `127.0.0.1` only.
- In development, the Vite server proxies `/api` requests to the loopback API.
- Do not expose or forward the API port or provider ports to untrusted networks.
- Production deployments must use a trusted reverse proxy and HTTPS. Same-origin frontend/API requests are accepted without CORS; cross-origin Android requests require the exact `https://localhost` origin in the CORS allowlist.
- The included Docker Compose configuration binds the service to loopback and stores SQLite in a persistent volume. Do not publish the backend port directly.

## Account authentication

- Each private installation has one owner account, created once during first-run setup.
- Owner passwords are stored as salted scrypt hashes. Passwords are never stored in plaintext.
- Sessions use random HttpOnly, SameSite=Strict cookies; HTTPS deployments set the Secure cookie attribute.
- SQLite stores only SHA-256 hashes of session tokens and their expiry timestamps.
- All application data, chat, search, settings, and provider routes require an active owner session. Health and authentication lifecycle endpoints are public.
- Login/setup attempts are rate-limited per process and client IP. This is not sufficient for a multi-instance public deployment; shared rate limiting and session controls would be required.
- See [AUTHENTICATION.md](./AUTHENTICATION.md) for setup and deployment constraints.

## User data

- Conversation history and user-saved memories are stored in the local SQLite database.
- Saved memory notes are included in later provider requests as bounded context. Users can review and delete saved notes in the Memory screen.
- Browser speech recognition may process audio using the browser vendor's online service. Android voice input uses the operating system's SpeechRecognizer service, which may stream audio to remote servers. Android microphone permission is requested only after the user starts voice input; recognition is not always-on. The app sends the resulting transcript to the selected AI provider. Browser speech synthesis reads replies using locally available browser/operating-system voices; voice availability varies by device.

## Workspace file access

- The user must explicitly select a folder through the browser File System Access API.
- ZARA lists a bounded number of files and reads supported text/source files only.
- File saves overwrite only the selected file and require a confirmation prompt.
- The web app does not offer file deletion, shell execution, or unrestricted filesystem access.
- The Windows Electron renderer has no Node integration and uses a sandboxed, context-isolated preload bridge.
- The preload bridge exposes only allowlisted Notepad/Calculator launch, validated HTTP(S) external links, and native text-file dialogs. File reads require a user-selected UTF-8 text/source file no larger than 500 KB. File writes use a user-selected Save As destination and a separate confirmation; allowed text extensions are enforced. Arbitrary path arguments, file deletion, and command execution are not exposed.

## Current security boundary

ZARA now includes single-owner authentication, but it is not a multi-user internet service. Keep the backend loopback-only unless it is deployed behind HTTPS, a trusted reverse proxy, an explicit CORS allowlist, and appropriate operational controls. Multi-user roles, shared rate limiting, password recovery, and deployment-specific monitoring are not implemented.

## Reporting

Do not paste provider keys, passwords, private files, or other credentials into GitHub issues, pull requests, screenshots, or ChatGPT.