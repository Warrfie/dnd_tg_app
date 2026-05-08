import assert from "node:assert/strict";
import test from "node:test";

process.env.TELEGRAM_BOT_TOKEN ??= "test-token";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/dnd_tg_app";

const [{ buildServer }, { prisma }, { ensureSeedData }, { resetDatabase, seedBaseData }] = await Promise.all([
  import("../../app.js"),
  import("../../common/prisma.js"),
  import("../../common/seed.js"),
  import("../../test/test-helpers.js")
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
    payload: {
      tableId: 1,
      date: futureDate(7),
      startTime: "19:00",
      endTime: "22:00",
      createdByName: "Саша",
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
  assert.deepEqual(body.participants, []);
  assert.equal(body.openToJoin, true);
  assert.equal(body.isPrivate, false);

  await app.close();
});

test("updates a booking only for its creator", async () => {
  const app = buildServer();

  const created = await app.inject({
    method: "POST",
    url: "/api/bookings",
    payload: {
      tableId: 1,
      date: futureDate(8),
      startTime: "18:00",
      endTime: "21:00",
      createdByName: "Саша",
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
    payload: {
      tableId: 1,
      date: futureDate(8),
      startTime: "19:00",
      endTime: "22:30",
      createdByName: "Саша",
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
    payload: {
      tableId: 1,
      date: futureDate(8),
      startTime: "19:00",
      endTime: "22:30",
      createdByName: "Макс",
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
    payload: {
      tableId: 2,
      date: futureDate(9),
      startTime: "12:00",
      endTime: "15:00",
      createdByName: "Макс",
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
    payload: { memberName: "Артем" }
  });

  assert.equal(joinResponse.statusCode, 200);
  const joined = joinResponse.json();
  assert.deepEqual(joined.participants, ["Артем"]);

  const duplicateJoin = await app.inject({
    method: "POST",
    url: `/api/bookings/${publicBooking.id}/join`,
    payload: { memberName: "Артем" }
  });

  assert.equal(duplicateJoin.statusCode, 400);

  const fullJoin = await app.inject({
    method: "POST",
    url: `/api/bookings/${publicBooking.id}/join`,
    payload: { memberName: "Ника" }
  });

  assert.equal(fullJoin.statusCode, 200);

  const overflowJoin = await app.inject({
    method: "POST",
    url: `/api/bookings/${publicBooking.id}/join`,
    payload: { memberName: "Саша" }
  });

  assert.equal(overflowJoin.statusCode, 409);

  const privateBookingResponse = await app.inject({
    method: "POST",
    url: "/api/bookings",
    payload: {
      tableId: 1,
      date: futureDate(10),
      startTime: "18:00",
      endTime: "22:00",
      createdByName: "Саша",
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
    payload: { memberName: "Ника" }
  });

  assert.equal(blockedJoin.statusCode, 400);

  await app.close();
});

test("cancels a booking only for its creator", async () => {
  const app = buildServer();

  const created = await app.inject({
    method: "POST",
    url: "/api/bookings",
    payload: {
      tableId: 1,
      date: futureDate(11),
      startTime: "10:00",
      endTime: "13:00",
      createdByName: "Саша",
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
    payload: { createdByName: "Макс" }
  });
  assert.equal(forbidden.statusCode, 403);

  const cancelled = await app.inject({
    method: "POST",
    url: `/api/bookings/${booking.id}/cancel`,
    payload: { createdByName: "Саша" }
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
    payload: {
      tableId: 1,
      date: futureDate(12),
      startTime: "18:00",
      endTime: "21:00",
      createdByName: "Саша",
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
    payload: {
      tableId: 1,
      date: futureDate(12),
      startTime: "20:00",
      endTime: "22:00",
      createdByName: "Макс",
      gameTitle: "Overlap",
      description: "Should fail",
      participantsCount: 2,
      isPrivate: false
    }
  });

  assert.equal(overlap.statusCode, 409);

  await app.close();
});
