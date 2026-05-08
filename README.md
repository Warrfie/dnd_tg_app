# DnD Telegram Mini App

Starter scaffold for a Telegram Mini App used by a private board games club.

## Apps

- `apps/web` - React + Vite Telegram Mini App frontend
- `apps/api` - Fastify backend API
- `db/prisma` - Prisma schema

## MVP scope

- 2 fixed tables
- current table status
- bookings for the next 30 days
- private/open games
- DnD-friendly booking description

## One-command server run

1. Clone the repository
2. Create root `.env`
3. Run `make run`

Minimal root `.env`:

```env
TELEGRAM_BOT_TOKEN=replace_me
WEB_ORIGIN=http://localhost:4000
```

This target will:

- stop stale local processes on ports `3000` and `4000`;
- restart Docker Compose services;
- start PostgreSQL;
- build the app container;
- apply Prisma schema;
- seed default data;
- start the app in detached mode with automatic restart policy.

Useful commands:

- `make run` - restart everything cleanly
- `make status` - show container status
- `make logs` - follow logs
- `make stop` - stop containers
- `make down` - stop and remove containers

What is intentionally not stored in root `.env`:

- database URLs
- internal app port
- frontend API base URL

Those values are provided by Docker Compose and app defaults.
