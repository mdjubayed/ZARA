# ZARA AI

ZARA is a bilingual Bengali/English personal AI assistant with a React frontend and a Node.js/Express backend.

## Approved AI architecture

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

## Local development

Install dependencies:

```bash
npm install
```

Create a private environment file from the example:

```bash
cp .env.example .env
```

Keep both provider API key and model values blank until you configure them yourself in your private environment. Never commit `.env`, paste credentials into source code, or store provider credentials in SQLite or application settings.

Start the API server in one terminal:

```bash
npm run server:dev
```

Start the Vite frontend in another terminal:

```bash
npm run dev
```

The Vite development server proxies `/api` requests to the ZARA API on port 3002.

## Environment configuration

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | ZARA API port | `3002` |
| `NODE_ENV` | Runtime environment | `development` |
| `ZARA_DATA_DIR` | SQLite data directory | `./data` |
| `OMNIROUTE_BASE_URL` | OmniRoute OpenAI-compatible API root | `http://127.0.0.1:20128/v1` |
| `OMNIROUTE_API_KEY` | Private OmniRoute credential | blank |
| `OMNIROUTE_MODEL` | OmniRoute model identifier | blank |
| `FREELLMAPI_BASE_URL` | FreeLLMAPI OpenAI-compatible API root | `http://127.0.0.1:3001/v1` |
| `FREELLMAPI_API_KEY` | Private FreeLLMAPI credential | blank |
| `FREELLMAPI_MODEL` | FreeLLMAPI model identifier | blank |
| `PROVIDER_TIMEOUT_MS` | Provider request timeout | `60000` |
| `CORS_ORIGINS` | Additional allowed browser origins | blank |

The default provider URLs assume the provider services are reachable from the same machine or Codespace as the ZARA backend. Change the URLs only to the actual private service endpoints you operate.

## API overview

All routes are under `/api/v1`:

- `GET /health` — backend health
- `/threads` — conversation threads
- `/threads/:threadId/messages` — thread messages
- `/settings` — non-secret application settings
- `/providers` — approved provider status and verification
- `POST /chat/stream` — streaming chat using Server-Sent Events
- `/search` — conversation search

Chat requests require a client-generated `clientMessageId`. The backend uses it to prevent duplicate user and assistant messages when a request is replayed.

## Security notes

- Provider keys are read from backend environment variables only.
- Provider credentials must never be committed to Git or returned by API responses.
- Application settings reject secret-like field names, including nested secret fields.
- Do not expose the backend or provider ports to an untrusted network.
- Configure production CORS origins explicitly.
- File and desktop automation features must use explicit permissions and safe workspace boundaries when implemented.

## Current implementation boundaries

Provider API calls cannot be verified until valid credentials and reachable provider services are configured privately. The UI must keep provider key and model fields blank by default. Voice, long-term memory, browser research, file operations, desktop control, and mobile/desktop packaging are separate roadmap phases and must not be presented as complete until implemented.
