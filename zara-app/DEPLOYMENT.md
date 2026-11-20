# ZARA Production Deployment

This repository includes a Docker deployment for a single-owner ZARA server. It does not deploy itself to a public hosting provider or create paid infrastructure.

## What the container runs

- React frontend and Express API served from the same HTTPS origin after a reverse proxy is configured.
- SQLite database stored in the persistent Docker volume `zara_data`.
- Single-owner password authentication.
- OmniRoute and FreeLLMAPI provider adapters.
- Health endpoint at `/api/v1/health`.

## Start locally

From the `zara-app` directory:

```bash
cp .env.docker.example .env
docker compose up --build -d
```

Open `http://localhost:3002` on the same computer. On first launch, create the owner password. The compose file binds the service to loopback only; it is not exposed directly to your LAN or the public internet.

## Provider configuration

The Docker environment template keeps both provider API key fields blank. Set keys only in the private `.env` file on the server or in the deployment platform's secret manager. Never commit that file or paste keys into ChatGPT.

The default Docker provider URLs target services running on the Docker host:
- OmniRoute: `http://host.docker.internal:20128/v1`
- FreeLLMAPI: `http://host.docker.internal:3001/v1`

Change the base URLs in the private `.env` file if your two approved provider services run elsewhere. No third AI provider is supported.

## Remote access and Android

Before connecting an Android APK or using ZARA outside the host computer:

1. Configure a domain and a trusted HTTPS reverse proxy.
2. Proxy requests to `http://127.0.0.1:3002`.
3. Keep the backend port private; expose only the HTTPS reverse proxy.
4. Keep `CORS_ORIGINS=https://localhost` so the Android WebView can authenticate. Add exact trusted cross-origin web origins only when required.
5. Keep the Docker volume `zara_data` persistent and back it up securely.

The same-origin web frontend is served by the backend. Android uses the HTTPS server address entered on its first launch and sends its owner session using Secure, HttpOnly cookies.

## Backups and recovery

- The SQLite database lives in the `zara_data` Docker volume.
- Back up the volume while the database is in a consistent state.
- The owner password cannot currently be reset through the UI. Preserve it safely.
- Provider keys are not stored in SQLite; back up your private secret manager separately.

## Stop and update

```bash
docker compose down
docker compose up --build -d
```

Do not add `-v` to the `down` command: that would remove the persistent database volume.
