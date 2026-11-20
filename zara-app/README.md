# ZARA AI

ZARA is a bilingual Bengali/English personal AI assistant with a React frontend and a Node.js/Express backend.

## Approved AI architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the request lifecycle, failover rules, and component boundaries.

ZARA uses one Brain Manager and exactly two approved AI providers:

1. **OmniRoute** — primary provider.
2. **FreeLLMAPI** — backup provider.

The Brain Manager tries the selected provider first (OmniRoute by default) and may fail over to the other provider for recoverable connection, timeout, rate-limit, or server errors. Authentication failures and user cancellation do not trigger failover. Streaming does not switch providers after any response token has already been sent to the client.

No additional AI providers are part of this architecture.

## Technology

- React 19, TypeScript, Vite
- Node.js, Express, TypeScript
- SQLite with better-sqlite3 and FTS5
- Zod request validation
- Server-Sent Events for chat streaming

## Account security

On first launch, ZARA asks you to create a single-owner password (12–128 characters). Later launches require that password. Passwords are stored as salted scrypt hashes, and session cookies are HttpOnly, SameSite=Strict, and Secure when served over HTTPS. Application APIs require an owner session; see [AUTHENTICATION.md](./AUTHENTICATION.md) for deployment requirements and limitations.

## Production deployment

A multi-stage Docker image and persistent Docker Compose setup are included. See [DEPLOYMENT.md](./DEPLOYMENT.md). The container serves the built frontend and protected API together; keep it behind HTTPS before remote access. The compose file binds the backend to loopback and persists SQLite data in a Docker volume.

## Local development

Install dependencies:

```bash
npm install
```

Create a private environment file from the example:

```bash
cp .env.example .env
```

Keep both provider API key and model values blank by default. After privately configuring a provider key, use Settings → AI Brain Settings to discover available models, choose one, and verify it; a model may also be supplied through its environment variable. Never commit `.env`, paste credentials into source code, or store provider credentials in SQLite or application settings.

Start the API server in one terminal:

```bash
npm run server:dev
```

Start the Vite frontend in another terminal:

```bash
npm run dev
```

The Vite development server proxies `/api` requests to the ZARA API on port 3002. The API binds to `127.0.0.1` only; do not expose or forward port 3002 directly. Keep the Vite/frontend port private as well.

## Environment configuration

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | ZARA API port | `3002` |
| `HOST` | API bind address | `127.0.0.1` |
| `SERVE_FRONTEND` | Serve built frontend from Express | `false` |
| `NODE_ENV` | Runtime environment | `development` |
| `ZARA_DATA_DIR` | SQLite data directory | `./data` |
| `OMNIROUTE_BASE_URL` | OmniRoute OpenAI-compatible API root | `http://127.0.0.1:20128/v1` |
| `OMNIROUTE_API_KEY` | Private OmniRoute credential | blank |
| `OMNIROUTE_MODEL` | Optional OmniRoute model override | blank |
| `FREELLMAPI_BASE_URL` | FreeLLMAPI OpenAI-compatible API root | `http://127.0.0.1:3001/v1` |
| `FREELLMAPI_API_KEY` | Private FreeLLMAPI credential | blank |
| `FREELLMAPI_MODEL` | Optional FreeLLMAPI model override | blank |
| `PROVIDER_TIMEOUT_MS` | Provider request timeout | `60000` |
| `CORS_ORIGINS` | Additional allowed browser origins | blank |

The default provider URLs assume the provider services are reachable from the same machine or Codespace as the ZARA backend. Change the URLs only to the actual private service endpoints you operate.

## API overview

All routes are under `/api/v1`:

- `GET /health` — backend health
- `/auth/status`, `/auth/setup`, `/auth/login`, `/auth/me`, `/auth/logout` — owner account and session lifecycle
- `/threads` — conversation threads
- `/threads/:threadId/messages` — thread messages
- `/settings` — non-secret application settings
- `/providers` — approved provider status and verification
- `POST /chat/stream` — streaming chat using Server-Sent Events
- `/search` — conversation search

Chat requests require a client-generated `clientMessageId`. The backend uses it to prevent duplicate user and assistant messages when a request is replayed.

## Security notes

See [SECURITY.md](./SECURITY.md) for the current trust boundary, local deployment guidance, and limitations.

- Provider keys are read from backend environment variables or the Windows desktop secure-storage bridge; never from application settings.
- Every application data and provider API route requires a valid owner session.
- Provider credentials must never be committed to Git or returned by API responses.
- Application settings reject secret-like field names, including nested secret fields.
- The ZARA API binds to loopback (`127.0.0.1`) and should not be exposed or forwarded directly.
- Do not expose provider ports to an untrusted network.
- On database startup, unsupported legacy provider rows are removed, provider configuration blobs are cleared, and secret-like keys are scrubbed from legacy settings.
- Configure production CORS origins explicitly.
- File and desktop automation features must use explicit permissions and safe workspace boundaries when implemented.

## Implemented frontend capabilities

- Bengali and English browser voice input using the browser speech-recognition API when supported.
- Browser speech synthesis for spoken replies to voice requests.
- Conversation history with open, rename, delete, and full-text search.
- User-managed persistent memory notes stored in the ZARA settings database and included as bounded context in later chats.
- Reusable agent instruction templates. These prepare prompts only and do not run autonomous background actions.
- Safe prompt tools for learning, writing, coding, and research planning.
- Explicit text-file attachments in chat, read in the browser and limited to 80 KB per file.
- Browser-based workspace access after the user explicitly chooses a folder: list up to 200 files across three folder levels, open supported text/source files up to 500 KB, and save edits only after confirmation. No file deletion or command execution.
- Conversation rename and deletion, with a confirmation step before deletion.

## Android app

A Capacitor Android shell and manual APK workflow are included. See [MOBILE.md](./MOBILE.md). The APK connects to a separately hosted HTTPS ZARA backend; first launch asks for its server address. Configure the backend CORS allowlist with `https://localhost` and use persistent storage for the SQLite database. The APK workflow has not yet been run, so no build artifact is claimed.

## Windows desktop app

The repository now includes an Electron desktop shell and a manual GitHub Actions workflow for creating a Windows x64 installer. Follow [DESKTOP.md](./DESKTOP.md). The package lock must be refreshed with `npm install` after pulling the new desktop and mobile dependencies. In the packaged Windows app, provider keys can be entered in Brain Settings and are encrypted with the Windows OS-backed secure-storage service; they are never returned to the frontend API or written to SQLite. No installer artifact is claimed until the workflow successfully builds it.

## Installing the web app

Deploy the frontend over HTTPS, open ZARA in a compatible browser, and use the browser's **Install app** option (Chrome/Edge desktop or Android Chrome). The app shell can load from cache after a visit, but chat, saved data, and provider calls still require the backend and provider services to be reachable.

## Remaining platform boundaries

- Browser voice recognition availability and language quality depend on the browser and operating system. Speech recognition may require browser permission and an internet connection; the browser provider may process voice input through its own online service.
- File access is limited to a user-selected folder through the browser File System Access API. Only supported text/source files are opened, edits require confirmation, and file deletion or shell execution is not available. Browser support requires a secure context and a compatible browser.
- A Windows Electron desktop packaging foundation is included. See [DESKTOP.md](./DESKTOP.md). The NSIS installer has not yet been built or verified. Native Windows automation, arbitrary file modification, background autonomous agents, external browser automation, advanced long-term semantic memory, and Android APK packaging are not implemented.
- Provider API calls cannot be verified until valid credentials and reachable provider services are configured privately. The UI must keep provider key and model fields blank by default.
- Do not describe a planned feature as complete until it has actually been implemented and verified.
