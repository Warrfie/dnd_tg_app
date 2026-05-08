# Telegram Mini App Deployment Guide

## What is standard for Telegram Mini Apps

For Telegram Mini Apps, the normal setup is:

1. frontend hosted on HTTPS;
2. backend API hosted on HTTPS;
3. bot configured in `@BotFather` with the Mini App URL;
4. local development exposed to Telegram through a public HTTPS tunnel.

Telegram Mini Apps are not typically tested through plain `localhost` inside the Telegram mobile client. In practice, teams use a tunnel for local testing and a separate staging URL for broader QA.

Official references used for this guide:

- Telegram Mini Apps docs: https://core.telegram.org/bots/webapps
- Cloudflare Tunnel docs: https://developers.cloudflare.com/tunnel/
- ngrok docs: https://ngrok.com/docs/start

## Recommended environments for this project

### Local development

Use this when you are coding on your machine.

- frontend: `http://localhost:3000`
- backend: `http://localhost:4000`
- database: local Postgres in Docker
- Telegram access: Cloudflare Tunnel or ngrok to expose the frontend

Recommended local workflow:

1. run API locally;
2. run web locally;
3. expose the web app over HTTPS with a tunnel;
4. set the bot Mini App URL to that tunnel URL for testing.

### Staging

Use this for QA and testing with real Telegram launch flows.

- frontend: Vercel, Netlify, or Cloudflare Pages
- backend: Railway, Render, or Fly.io
- database: hosted Postgres
- bot points to staging Mini App URL

Best practice:

- use a separate staging bot, or at minimum a separate staging Mini App URL;
- do not test new features against production data first.

### Production

Use this for the actual club members.

- frontend: permanent HTTPS domain
- backend: permanent HTTPS API
- database: managed Postgres with backups
- bot menu button and Main Mini App set to production URL

## Fast local start for this repository

### 1. Install dependencies

```bash
npm install
```

### 2. Start PostgreSQL in Docker

```bash
docker compose up -d
```

This uses [docker-compose.yml](/Users/warrfie/dnd_tg_app/docker-compose.yml) and starts Postgres on `localhost:5432`.

### 3. Create env files

Root `.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dnd_tg_app
TELEGRAM_BOT_TOKEN=replace_me
WEB_ORIGIN=http://localhost:3000
PORT=4000
```

Frontend `apps/web/.env`:

```env
VITE_API_BASE_URL=http://localhost:4000/api
```

Backend `apps/api/.env`:

```env
PORT=4000
WEB_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dnd_tg_app
TELEGRAM_BOT_TOKEN=replace_me
```

### 4. Start the backend

```bash
npm run dev:api
```

### 5. Start the frontend

```bash
npm run dev:web
```

### 6. Open the local app in browser

- frontend: `http://localhost:3000`
- backend health: `http://localhost:4000/health`

This is enough to test layout and API stubs in a browser before Telegram integration.

## How to test inside Telegram locally

Telegram mobile clients need a public HTTPS URL. The simplest options are:

### Option A: Cloudflare Tunnel

Quick testing:

```bash
cloudflared tunnel --url http://localhost:3000
```

This gives you a temporary public HTTPS URL on `trycloudflare.com`.

Use it for:

- personal testing;
- short-lived debugging;
- sending yourself a temporary test link.

Limitations from Cloudflare docs:

- quick tunnels are for testing only;
- they should not be used as production infrastructure.

### Option B: ngrok

```bash
ngrok http 3000
```

This gives you a public HTTPS URL that forwards to local frontend.

Use it when:

- you already use ngrok;
- you want a familiar tunnel workflow;
- you need a quick temporary public address.

### Then configure the bot

In `@BotFather`:

1. create or select the bot;
2. configure Main Mini App or Menu Button;
3. paste the public HTTPS URL from Cloudflare Tunnel or ngrok.

You can also test by direct link:

```text
https://t.me/<bot_username>?startapp
```

Telegram’s official Mini App docs explicitly support `startapp` direct links.

## Recommended staging setup

For this project, the cleanest staging stack is:

- frontend on Vercel
- backend on Railway
- Postgres on Railway, Neon, or Supabase
- staging bot or staging URL

### Staging checklist

1. deploy frontend with environment variable:
   - `VITE_API_BASE_URL=https://api-staging.example.com/api`
2. deploy backend with:
   - `DATABASE_URL`
   - `TELEGRAM_BOT_TOKEN`
   - `WEB_ORIGIN=https://staging.example.com`
3. point the bot Mini App URL at `https://staging.example.com`
4. test launch from Telegram mobile
5. test auth validation and booking creation

## Recommended production setup

### Frontend

- host on a stable HTTPS domain such as `https://tables.example.com`
- lock CORS to the real frontend domain

### Backend

- host on `https://api.example.com`
- store secrets in platform secret manager
- enable logs and monitoring

### Database

- managed Postgres
- backups enabled
- migration process defined before each release

### Bot

- Main Mini App URL points to production frontend
- Menu Button points to production frontend
- optional direct links posted in the club channel

### Production checklist

1. use separate staging and production environments
2. keep production bot token separate from staging
3. validate Telegram `initData` on every authenticated session start
4. add rate limiting and server-side conflict checks before opening access to real users
5. keep database backups enabled

## Best practice for this repository right now

The shortest path to something you can touch today is:

1. run the frontend and backend locally;
2. verify browser flow on `localhost`;
3. expose the frontend through Cloudflare Tunnel or ngrok;
4. connect that URL to a test bot in Telegram;
5. only after that set up a staging deployment.

That is how Mini Apps are usually iterated in practice: local browser first, then local tunnel in Telegram, then staging, then production.
