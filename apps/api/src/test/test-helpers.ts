import { prisma } from "../common/prisma.js";

export async function resetDatabase() {
  await prisma.bookingParticipant.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.game.deleteMany();
  await prisma.member.deleteMany();
  await prisma.table.deleteMany();
}

export async function seedBaseData() {
  await prisma.table.createMany({
    data: [
      { id: 1, name: "Стол 1", isActive: true },
      { id: 2, name: "Стол 2", isActive: true }
    ]
  });

  await prisma.member.createMany({
    data: [
      { firstName: "Саша", isAdmin: true },
      { firstName: "Макс", isAdmin: false },
      { firstName: "Артем", isAdmin: false },
      { firstName: "Ника", isAdmin: false }
    ]
  });
}

