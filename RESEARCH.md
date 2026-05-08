# Telegram Mini App Research for Board Games Club

## Коротко по-русски

Это исследование для Telegram Mini App клуба настольных игр.

Что рекомендовано:

- запускать приложение как `Main Mini App` у бота;
- добавить `Menu Button` у бота;
- дать прямую `startapp` ссылку в канале или закрепе;
- хранить брони не в чате, а в backend + PostgreSQL;
- делать 2 фиксированных стола на MVP;
- разрешать бронирование только на следующие 30 дней;
- показывать календарь на текущий и следующий месяц, но блокировать прошедшие даты и даты вне окна бронирования;
- сделать отдельное описание игры для DnD-сессий;
- поддержать режимы `приватная игра` и `можно присоединиться`.

Технически это обычное веб-приложение внутри Telegram. Пользователь открывает Mini App через бота, фронтенд получает `initData`, а backend обязан валидировать его подпись по официальным правилам Telegram.

## Goal

Build a Telegram Mini App for a private board games club. The app should let members:

- see 2 tables and their current status;
- see who is playing now;
- see who booked a table, for what time, for which game;
- see participants;
- mark a game as private or open for extra players;
- create a booking;
- add a game title and a longer game description;
- choose exact users or only set participant count;
- work with a rolling booking window of 30 days;
- show calendar days for roughly 2 months, while past dates are disabled and booking is only allowed inside the next 30 days.

Assumption:
The phrase about "2 months" and "30 days" is implemented as:

- UI can display days across the current and next month;
- past dates are disabled;
- booking is allowed only from `today` through `today + 30 days`.

If needed, this rule can be changed later without changing the overall architecture.

## What Telegram Mini Apps Are

Telegram Mini Apps are regular web applications opened inside Telegram. They run with HTML/CSS/JavaScript, can be launched from a bot, and receive Telegram session data in `Telegram.WebApp.initData`, which must be validated on the backend.

For this project, the Mini App is the correct fit because:

- users already live in Telegram;
- launch friction is low;
- the club already communicates in a Telegram channel/chat;
- the app needs structured UI, not just commands and messages.

## Current Official Platform Notes

Verified on May 8, 2026 from official Telegram docs:

- Telegram Mini Apps are documented at `https://core.telegram.org/bots/webapps`
- They support main Mini App launch, menu button launch, inline button launch, and direct links like `https://t.me/botusername?startapp`
- `telegram-web-app.js` is still the official bridge script for Telegram client integration
- `initData` must be validated on the server before trusting the user identity
- Mini Apps can react to theme and viewport changes and should be mobile-first

Important recent platform capabilities from the official docs:

- Main Mini App profile launch is available and is the best default entry point for this use case
- Fullscreen support exists and is useful for calendar/table views
- Safe area APIs exist and should be respected on mobile devices
- Device storage and secure storage exist, but should not be the source of truth for bookings

## Best Launch Strategy for This Club

Recommended launch modes:

1. Main Mini App on the bot profile
2. Menu button in the bot chat
3. Direct link from the club channel or pinned message

Why this combination:

- profile launch makes the app easy to find later;
- menu button gives persistent access in chat;
- direct link is perfect for channel posts like "Open the booking board".

Not recommended as the main path:

- attachment menu flow, because Telegram notes that full attachment menu integration is restricted and not a practical baseline for a small private club;
- keyboard-button-only flow, because it is too limited for a real booking UI.

## Product Shape for MVP

### Main screens

1. Dashboard
   - current status of both tables;
   - who is playing now;
   - next bookings for today.

2. Calendar / Schedule
   - day picker;
   - timeline or card view for both tables;
   - disabled past dates;
   - disabled dates beyond booking window.

3. Booking details
   - table;
   - time slot;
   - game;
   - organizer;
   - participant list or participant count;
   - privacy flag;
   - joinability flag;
   - description.

4. Create / Edit booking
   - table select: `Table 1`, `Table 2`;
   - date;
   - start time;
   - end time;
   - game title;
   - description;
   - participant mode:
     - explicit members list;
     - count only;
   - private game: yes/no;
   - open to additional players: yes/no.

### Suggested roles

- member: can view and create bookings;
- organizer/admin: can edit any booking, manage tables, manage members.

## Core Business Rules

1. A table cannot have overlapping bookings.
2. Booking can be created only inside the next 30 days.
3. Past time slots cannot be booked.
4. `private = true` means outsiders should not join without invite.
5. `open_to_join = true` means other members may request or directly join, depending on club policy.
6. `participants_count` should exist even if named participants are not fully known yet.
7. The backend, not the frontend, must enforce booking conflicts and booking-window rules.

## Recommended Data Model

### tables

- `id`
- `name` (`Table 1`, `Table 2`)
- `capacity` nullable
- `is_active`

### members

- `id`
- `telegram_user_id`
- `username`
- `first_name`
- `last_name`
- `is_admin`
- `is_active`

### games

- `id`
- `title`
- `category` (`boardgame`, `dnd`, `warhammer`, `other`)
- `default_description` nullable

### bookings

- `id`
- `table_id`
- `created_by_member_id`
- `game_id` nullable
- `custom_game_title`
- `description`
- `start_at`
- `end_at`
- `is_private`
- `open_to_join`
- `participants_count`
- `status` (`active`, `cancelled`, `completed`)
- `created_at`
- `updated_at`

### booking_participants

- `id`
- `booking_id`
- `member_id`
- `role` (`organizer`, `player`, `gm`, `guest`)

### booking_join_requests (optional for phase 2)

- `id`
- `booking_id`
- `member_id`
- `status` (`pending`, `approved`, `rejected`)

## Suggested UX Decisions

### Timeline granularity

Use 30-minute slots. This is a good balance for tabletop scheduling.

### Current status block

Each table card should show:

- `Свободен сейчас` or `Занят сейчас`
- game title
- organizer
- participant count
- privacy label
- time range

### Privacy display

- `Приватная игра`
- `Можно присоединиться`
- `Мест нет`

### DnD support

Dnd sessions need a real description field. Keep it multiline and visible in booking details.

Recommended extra fields for later:

- `campaign_name`
- `session_number`
- `gm_notes`

### Warhammer support

No special architecture is required. Treat it as a game category.

## Recommended Tech Stack

For this project, the simplest solid stack is:

- frontend: React + Vite + TypeScript
- Telegram integration: official `telegram-web-app.js`, optionally with a Telegram Mini Apps SDK wrapper
- backend: Node.js + Fastify or NestJS
- database: PostgreSQL
- ORM: Prisma
- auth model: Telegram `initData` verification on backend, then app session cookie or short-lived token
- deploy:
  - frontend on Vercel / Netlify / static hosting with HTTPS
  - backend on Railway / Render / Fly.io
  - database on Neon / Supabase Postgres / Railway Postgres

Why this stack:

- easy to hire for;
- fast iteration;
- strong TypeScript support;
- straightforward Telegram integration;
- reliable relational model for bookings and conflicts.

## Architecture

### Frontend

- reads Telegram theme and viewport state;
- sends `initData` to backend once on app start;
- receives authenticated member profile;
- fetches table state and bookings;
- creates and edits bookings through API.

### Backend

- validates `initData` signature;
- maps Telegram user to local member record;
- enforces permissions;
- enforces booking-window and overlap rules;
- exposes booking and member APIs;
- optionally posts updates into the club chat later.

### Database

PostgreSQL is preferred because:

- booking conflict logic is easier to manage;
- reporting is easier later;
- migrations are predictable.

## API Draft

### auth

- `POST /auth/telegram`
  - body: `initData`
  - validates Telegram signature
  - returns member profile and session

### tables

- `GET /tables`
- `GET /tables/current`

### bookings

- `GET /bookings?from=...&to=...`
- `GET /bookings/:id`
- `POST /bookings`
- `PATCH /bookings/:id`
- `DELETE /bookings/:id` or `POST /bookings/:id/cancel`

### members

- `GET /members`

### join flow (phase 2)

- `POST /bookings/:id/join`
- `POST /bookings/:id/request`
- `POST /join-requests/:id/approve`

## Telegram Bot Responsibilities

The bot should:

- host the Mini App entry point;
- provide a menu button;
- publish a `startapp` link for the club channel;
- optionally send reminders before bookings;
- optionally post "Table 1 booked for today 19:00-22:00" updates to chat.

The bot should not be the source of truth for schedule state. The backend and database should own the schedule.

## Security Notes

1. Never trust `initDataUnsafe` alone.
2. Always validate `initData` on the backend using Telegram's documented signature rules.
3. Do not let the client decide whether overlapping bookings are allowed.
4. Add server-side validation for:
   - end after start;
   - booking window;
   - table overlap;
   - participant counts.

## Delivery Plan

### Phase 1

- Telegram bot
- Mini App shell
- Telegram auth
- 2 tables
- day view
- booking create/edit/cancel
- private/open flags
- participants list or count

### Phase 2

- join requests
- notifications in chat
- reminders
- admin panel
- game templates for DnD and Warhammer

### Phase 3

- recurring events
- waitlist
- analytics
- club member management

## Suggested MVP Scope for This Exact Project

If the goal is to ship quickly, the MVP should be:

- exactly 2 fixed tables;
- club members only;
- booking window: next 30 days;
- calendar view for current and next month;
- create booking with:
  - table,
  - date,
  - time,
  - game title,
  - description,
  - participant count or selected members,
  - privacy,
  - open-to-join flag;
- dashboard with current table occupancy and next bookings.

This is enough to replace messy chat coordination without overbuilding.

## Implementation Recommendation

For this repository, the best next step is:

1. scaffold frontend Mini App;
2. scaffold backend auth + bookings API;
3. connect Telegram `initData` auth;
4. implement fixed 2-table schedule;
5. deploy HTTPS endpoints;
6. connect bot menu button and `startapp` link.

## Sources

- Telegram Mini Apps docs: https://core.telegram.org/bots/webapps
- Telegram Bot API docs: https://core.telegram.org/bots/api
- Telegram Mini Apps community docs: https://docs.telegram-mini-apps.com/
