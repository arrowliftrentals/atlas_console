# ATLAS Web Console — Deployment Guide

## Prerequisites
- Node.js 18+ (LTS recommended)
- ATLAS Core backend accessible over the network
- npm or equivalent package manager

## Architecture Overview

The console is a Next.js application that proxies all HTTP requests to the ATLAS Core backend through server-side rewrite rules. This means:

- **HTTP endpoints** (`/v1/*`, `/api/*`, `/health`) are rewritten by Next.js to the backend. The browser never contacts the backend directly.
- **WebSocket endpoints** (telemetry, progress streams) connect directly to the backend, since Next.js rewrites cannot proxy WebSocket upgrades.

```
Browser
  ├── HTTP requests ──→ Next.js server ──(rewrite)──→ ATLAS backend
  └── WebSocket ──────────────────────────────────────→ ATLAS backend
```

## Environment Variables

### Server-side only (never exposed to the browser)

| Variable | Purpose | Default |
|---|---|---|
| `ATLAS_BACKEND_URL` | Backend URL used by the Next.js rewrite proxy. Takes highest priority for HTTP routing. | (falls through to `NEXT_PUBLIC_ATLAS_API_URL`) |

### Shared (available on both server and client)

| Variable | Purpose | Default |
|---|---|---|
| `NEXT_PUBLIC_ATLAS_API_URL` | Backend URL used as fallback for HTTP rewrites **and** as the base for WebSocket connections on the client. | `http://127.0.0.1:8000` |

### Client-only API keys (optional features)

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | OpenAI — used for WebRTC voice relay |
| `NEXT_PUBLIC_ELEVENLABS_API_KEY` | ElevenLabs — real-time STT and TTS |
| `CARTESIA_API_KEY` | Cartesia Sonic 3 — alternative TTS |
| `PINECONE_API_KEY` | Pinecone — semantic vector memory |
| `ANTHROPIC_API_KEY` | Anthropic Claude — LLM provider |

> **Security:** Never commit `.env.local` or any file containing secrets. The `.gitignore` already excludes `.env*.local`. For production, inject secrets via your hosting platform's environment variable system.

## How the proxy works

`next.config.js` defines three rewrite rules:

```
/v1/*     →  ${ATLAS_BACKEND_URL}/v1/*
/api/*    →  ${ATLAS_BACKEND_URL}/api/*
/health   →  ${ATLAS_BACKEND_URL}/health
```

The backend URL is resolved at server start in this order:
1. `ATLAS_BACKEND_URL` (server-only, highest priority)
2. `NEXT_PUBLIC_ATLAS_API_URL` (shared, fallback)
3. `http://127.0.0.1:8000` (hardcoded default)

WebSocket connections use `NEXT_PUBLIC_ATLAS_API_URL` at build time (inlined by Next.js into the client bundle). The `lib/api.ts` helper `getAtlasWsUrl()` derives `ws://` or `wss://` from this value.

## Build

```bash
npm ci
npm run build
```

This produces a production build in `.next/`. The `NEXT_PUBLIC_*` variables are baked in at build time, so set them **before** building.

## Deployment Options

### Option 1: Standalone Node.js server

Best for: VPS, bare-metal, Docker containers.

```bash
# Set env vars
export ATLAS_BACKEND_URL=http://atlas-backend:8000
export NEXT_PUBLIC_ATLAS_API_URL=https://atlas.example.com

# Build and start
npm ci
npm run build
npm run start    # Starts on port 3000 by default
```

To change the port:
```bash
PORT=8080 npm run start
```

### Option 2: Docker

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production=false

FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_ATLAS_API_URL=http://127.0.0.1:8000
ENV NEXT_PUBLIC_ATLAS_API_URL=$NEXT_PUBLIC_ATLAS_API_URL
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./

EXPOSE 3000
CMD ["npm", "run", "start"]
```

Build and run:
```bash
docker build \
  --build-arg NEXT_PUBLIC_ATLAS_API_URL=https://atlas.example.com \
  -t atlas-console .

docker run -p 3000:3000 \
  -e ATLAS_BACKEND_URL=http://atlas-backend:8000 \
  atlas-console
```

Note: `NEXT_PUBLIC_ATLAS_API_URL` is a **build arg** (baked into the JS bundle). `ATLAS_BACKEND_URL` is a **runtime env var** (used by the Node.js server for rewrites).

### Option 3: Vercel

1. Import the repository.
2. Set environment variables in the Vercel dashboard:
   - `NEXT_PUBLIC_ATLAS_API_URL` = your backend's public URL (e.g. `https://atlas-api.example.com`)
   - All API keys as needed
3. Deploy. Vercel handles `npm run build` and hosting automatically.

**Important:** The ATLAS Core backend must be publicly reachable (or reachable from Vercel's network) for the rewrite proxy to work. WebSocket connections go from the user's browser directly to the backend, so the backend must also be accessible from the internet (or from the user's network).

### Option 4: Behind a reverse proxy (nginx)

If both the console and backend run on the same server:

```nginx
server {
    listen 443 ssl;
    server_name atlas.example.com;

    # Console (Next.js)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Direct WebSocket access to backend (optional — only if you want
    # to bypass the console for WS connections)
    location /v1/telemetry/stream {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /v1/progress/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

In this setup, set `NEXT_PUBLIC_ATLAS_API_URL=https://atlas.example.com` so that WebSocket connections from the browser target the nginx proxy (which upgrades them to the backend).

## WebSocket endpoints

These paths use WebSocket and must reach the backend directly (not through Next.js rewrites):

| Path | Purpose |
|---|---|
| `/v1/telemetry/stream` | Real-time telemetry events (heartbeat, execution flows) |
| `/v1/progress/stream/{session_id}` | Task progress updates |
| `/api/analysis/ws/{run_id}` | Code analysis progress |

All are derived from `NEXT_PUBLIC_ATLAS_API_URL` via `getAtlasWsUrl()` in `lib/api.ts`.

## Verifying the deployment

```bash
# 1. Check the console is serving
curl -s http://localhost:3000 | head -1

# 2. Check the proxy reaches the backend
curl -s http://localhost:3000/health

# 3. Check a proxied API endpoint
curl -s http://localhost:3000/v1/architecture/graph | python3 -m json.tool | head -5

# 4. Check WebSocket connectivity (requires wscat or similar)
npx wscat -c ws://localhost:8000/v1/telemetry/stream
```

## Troubleshooting

**Console loads but cards show errors / no data:**
- The backend is unreachable from the Next.js server. Check `ATLAS_BACKEND_URL`.
- Run `curl http://localhost:3000/health` — if this fails, the rewrite proxy can't reach the backend.

**WebSocket connections fail (telemetry offline, no particles):**
- `NEXT_PUBLIC_ATLAS_API_URL` must point to a URL the user's browser can reach.
- If behind nginx, ensure `Upgrade` and `Connection` headers are proxied for WS paths.
- Check browser console for WebSocket connection errors.

**CORS errors in browser console:**
- All HTTP requests should go through the proxy (relative URLs). If you see CORS errors, a component may still be using an absolute URL. Check for any remaining hardcoded URLs with:
  ```bash
  grep -rn 'http://localhost:8000\|http://127.0.0.1:8000' components/ contexts/ lib/
  ```

**Build fails with NEXT_PUBLIC_ATLAS_API_URL errors:**
- This variable is optional. The default (`http://127.0.0.1:8000`) is used if not set. Ensure it's set before `npm run build` if you need a different value.
