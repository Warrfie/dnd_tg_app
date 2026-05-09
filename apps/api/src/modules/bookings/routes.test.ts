import assert from "node:assert/strict";
import test from "node:test";

process.env.TELEGRAM_BOT_TOKEN ??= "test-token";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/dnd_tg_app";

const [{ buildServer }, { prisma }, { ensureSeedData }, { resetDatabase, seedBaseData }, { telegramHeaders }] = await Promise.all([
  import("../../app.js"),
  import("../../common/prisma.js"),
  import("../../common/seed.js"),
  import("../../test/test-helpers.js"),
  import("../../test/telegram-auth.js")
]);

function futureDate(daysAhead: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

test.before(async () => {
  await prisma.$connect();
});

test.after(async () => {
  await resetDatabase();
  await ensureSeedData();
  await prisma.$disconnect();
});

test.beforeEach(async () => {
  await resetDatabase();
  await seedBaseData();
});

test("creates a booking with organizer only and public join enabled", async () => {
  const app = buildServer();

  const response = await app.inject({
    method: "POST",
    url: "/api/bookings",
    headers: telegramHeaders({ id: 101, first_name: "Саша", username: "sasha" }),
    payload: {
      tableId: 1,
      date: futureDate(7),
      startTime: "19:00",
      endTime: "22:00",
      gameTitle: "D&D Test",
      description: "Тестовая бронь",
      participantsCount: 4,
      isPrivate: false
    }
  });

  assert.equal(response.statusCode, 201);
  const body = response.json();
  assert.equal(body.gameTitle, "D&D Test");
  assert.equal(body.createdBy, "Саша");
  assert.equal(body.createdByTelegramUserId, "101");
  assert.equal(body.organizerUsername, "sasha");
  assert.deepEqual(body.participants, []);
  assert.equal(body.joinedCount, 0);
  assert.equal(body.availableSlots, 4);
  assert.equal(body.openToJoin, true);
  assert.equal(body.isPrivate, false);

  await app.close();
});

test("updates a booking only for its creator", async () => {
  const app = buildServer();

  const created = await app.inject({
    method: "POST",
    url: "/api/bookings",
    headers: telegramHeaders({ id: 101, first_name: "Саша", username: "sasha" }),
    payload: {
      tableId: 1,
      date: futureDate(8),
      startTime: "18:00",
      endTime: "21:00",
      gameTitle: "Old Name",
      description: "Before edit",
      participantsCount: 5,
      isPrivate: true
    }
  });
  const booking = created.json();

  const updated = await app.inject({
    method: "PATCH",
    url: `/api/bookings/${booking.id}`,
    headers: telegramHeaders({ id: 101, first_name: "Саша", username: "sasha" }),
    payload: {
      tableId: 1,
      date: futureDate(8),
      startTime: "19:00",
      endTime: "22:30",
      gameTitle: "New Name",
      description: "After edit",
      participantsCount: 3,
      isPrivate: false
    }
  });

  assert.equal(updated.statusCode, 200);
  const body = updated.json();
  assert.equal(body.gameTitle, "New Name");
  assert.equal(body.description, "After edit");
  assert.equal(body.participantsCount, 3);
  assert.equal(body.openToJoin, true);

  const forbidden = await app.inject({
    method: "PATCH",
    url: `/api/bookings/${booking.id}`,
    headers: telegramHeaders({ id: 202, first_name: "Макс", username: "max" }),
    payload: {
      tableId: 1,
      date: futureDate(8),
      startTime: "19:00",
      endTime: "22:30",
      gameTitle: "Hijack",
      description: "Nope",
      participantsCount: 3,
      isPrivate: false
    }
  });

  assert.equal(forbidden.statusCode, 403);

  await app.close();
});

test("joins a public booking and rejects duplicate joins and private joins", async () => {
  const app = buildServer();

  const publicBookingResponse = await app.inject({
    method: "POST",
    url: "/api/bookings",
    headers: telegramHeaders({ id: 202, first_name: "Макс", username: "max" }),
    payload: {
      tableId: 2,
      date: futureDate(9),
      startTime: "12:00",
      endTime: "15:00",
      gameTitle: "Public Game",
      description: "Joinable",
      participantsCount: 2,
      isPrivate: false
    }
  });
  const publicBooking = publicBookingResponse.json();

  const joinResponse = await app.inject({
    method: "POST",
    url: `/api/bookings/${publicBooking.id}/join`,
    headers: telegramHeaders({ id: 303, first_name: "Артем", username: "artem" })
  });

  assert.equal(joinResponse.statusCode, 200);
  const joined = joinResponse.json();
  assert.equal(joined.joinedCount, 1);
  assert.equal(joined.availableSlots, 1);
  assert.deepEqual(joined.participants, [
    {
      memberId: joined.participants[0].memberId,
      telegramUserId: "303",
      name: "Артем",
      username: "artem",
      role: "player"
    }
  ]);

  const duplicateJoin = await app.inject({
    method: "POST",
    url: `/api/bookings/${publicBooking.id}/join`,
    headers: telegramHeaders({ id: 303, first_name: "Артем", username: "artem" })
  });

  assert.equal(duplicateJoin.statusCode, 400);

  const fullJoin = await app.inject({
    method: "POST",
    url: `/api/bookings/${publicBooking.id}/join`,
    headers: telegramHeaders({ id: 404, first_name: "Ника", username: "nika" })
  });

  assert.equal(fullJoin.statusCode, 200);

  const overflowJoin = await app.inject({
    method: "POST",
    url: `/api/bookings/${publicBooking.id}/join`,
    headers: telegramHeaders({ id: 101, first_name: "Саша", username: "sasha" })
  });

  assert.equal(overflowJoin.statusCode, 409);

  const privateBookingResponse = await app.inject({
    method: "POST",
    url: "/api/bookings",
    headers: telegramHeaders({ id: 101, first_name: "Саша", username: "sasha" }),
    payload: {
      tableId: 1,
      date: futureDate(10),
      startTime: "18:00",
      endTime: "22:00",
      gameTitle: "Private Game",
      description: "No joins",
      participantsCount: 4,
      isPrivate: true
    }
  });
  const privateBooking = privateBookingResponse.json();

  const blockedJoin = await app.inject({
    method: "POST",
    url: `/api/bookings/${privateBooking.id}/join`,
    headers: telegramHeaders({ id: 404, first_name: "Ника", username: "nika" })
  });

  assert.equal(blockedJoin.statusCode, 400);

  await app.close();
});

test("allows a joined player to leave and organizer to remove participant", async () => {
  const app = buildServer();

  const created = await app.inject({
    method: "POST",
    url: "/api/bookings",
    headers: telegramHeaders({ id: 101, first_name: "Саша", username: "sasha" }),
    payload: {
      tableId: 2,
      date: futureDate(10),
      startTime: "14:00",
      endTime: "18:00",
      gameTitle: "Roster Test",
      description: "Manage roster",
      participantsCount: 3,
      isPrivate: false
    }
  });
  const booking = created.json();

  const joined = await app.inject({
    method: "POST",
    url: `/api/bookings/${booking.id}/join`,
    headers: telegramHeaders({ id: 303, first_name: "Артем", username: "artem" })
  });
  assert.equal(joined.statusCode, 200);

  const afterLeave = await app.inject({
    method: "POST",
    url: `/api/bookings/${booking.id}/leave`,
    headers: telegramHeaders({ id: 303, first_name: "Артем", username: "artem" })
  });
  assert.equal(afterLeave.statusCode, 200);
  assert.equal(afterLeave.json().joinedCount, 0);

  await app.inject({
    method: "POST",
    url: `/api/bookings/${booking.id}/join`,
    headers: telegramHeaders({ id: 404, first_name: "Ника", username: "nika" })
  });

  const withParticipant = await app.inject({
    method: "GET",
    url: `/api/bookings/${booking.id}`
  });
  const participantId = withParticipant.json().participants[0].memberId;

  const removed = await app.inject({
    method: "DELETE",
    url: `/api/bookings/${booking.id}/participants/${participantId}`,
    headers: telegramHeaders({ id: 101, first_name: "Саша", username: "sasha" })
  });
  assert.equal(removed.statusCode, 200);
  assert.equal(removed.json().joinedCount, 0);

  await app.close();
});

test("cancels a booking only for its creator", async () => {
  const app = buildServer();

  const created = await app.inject({
    method: "POST",
    url: "/api/bookings",
    headers: telegramHeaders({ id: 101, first_name: "Саша", username: "sasha" }),
    payload: {
      tableId: 1,
      date: futureDate(11),
      startTime: "10:00",
      endTime: "13:00",
      gameTitle: "Cancelable",
      description: "Cancel me",
      participantsCount: 3,
      isPrivate: false
    }
  });
  const booking = created.json();

  const forbidden = await app.inject({
    method: "POST",
    url: `/api/bookings/${booking.id}/cancel`,
    headers: telegramHeaders({ id: 202, first_name: "Макс", username: "max" })
  });
  assert.equal(forbidden.statusCode, 403);

  const cancelled = await app.inject({
    method: "POST",
    url: `/api/bookings/${booking.id}/cancel`,
    headers: telegramHeaders({ id: 101, first_name: "Саша", username: "sasha" })
  });
  assert.equal(cancelled.statusCode, 200);
  assert.equal(cancelled.json().status, "cancelled");

  await app.close();
});

test("rejects overlapping bookings for the same table", async () => {
  const app = buildServer();

  const first = await app.inject({
    method: "POST",
    url: "/api/bookings",
    headers: telegramHeaders({ id: 101, first_name: "Саша", username: "sasha" }),
    payload: {
      tableId: 1,
      date: futureDate(12),
      startTime: "18:00",
      endTime: "21:00",
      gameTitle: "First",
      description: "First slot",
      participantsCount: 4,
      isPrivate: false
    }
  });
  assert.equal(first.statusCode, 201);

  const overlap = await app.inject({
    method: "POST",
    url: "/api/bookings",
    headers: telegramHeaders({ id: 202, first_name: "Макс", username: "max" }),
    payload: {
      tableId: 1,
      date: futureDate(12),
      startTime: "20:00",
      endTime: "22:00",
      gameTitle: "Overlap",
      description: "Should fail",
      participantsCount: 2,
      isPrivate: false
    }
  });

  assert.equal(overlap.statusCode, 409);

  await app.close();
});
