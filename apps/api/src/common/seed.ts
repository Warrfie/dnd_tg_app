import { prisma } from "./prisma.js";

const starterMembers = [
  { firstName: "Саша", isAdmin: true },
  { firstName: "Ника", isAdmin: false },
  { firstName: "Илья", isAdmin: false },
  { firstName: "Паша", isAdmin: false },
  { firstName: "Лена", isAdmin: false },
  { firstName: "Макс", isAdmin: false },
  { firstName: "Артем", isAdmin: false },
  { firstName: "Вика", isAdmin: false },
  { firstName: "Кирилл", isAdmin: false },
  { firstName: "Антон", isAdmin: false },
  { firstName: "Дима", isAdmin: false },
  { firstName: "Оля", isAdmin: false },
  { firstName: "Женя", isAdmin: false }
];

function atLocalDate(base: Date, addDaysCount: number, hours: number, minutes = 0) {
  const value = new Date(base);
  value.setDate(value.getDate() + addDaysCount);
  value.setHours(hours, minutes, 0, 0);
  return value;
}

export async function ensureSeedData() {
  const tableCount = await prisma.table.count();

  if (tableCount === 0) {
    await prisma.table.createMany({
      data: [
        { id: 1, name: "Стол 1", isActive: true },
        { id: 2, name: "Стол 2", isActive: true }
      ]
    });
  }

  for (const member of starterMembers) {
    await prisma.member.upsert({
      where: { id: (await prisma.member.findFirst({ where: { firstName: member.firstName } }))?.id ?? -1 },
      update: {},
      create: member
    });
  }

  const bookingCount = await prisma.booking.count();
  if (bookingCount > 0) {
    return;
  }

  const members = await prisma.member.findMany();
  const memberByName = new Map(members.map((member) => [member.firstName, member]));

  const now = new Date();
  const seedBookings = [
    {
      tableId: 1,
      createdBy: "Саша",
      gameTitle: "D&D: Curse of Strahd",
      description: "Продолжение кампании. Нужны персонажи 5 уровня, играем через социальку и бой.",
      participants: ["Саша", "Ника", "Илья", "Паша", "Лена"],
      participantsCount: 5,
      isPrivate: true,
      openToJoin: false,
      startAt: atLocalDate(now, 0, 19, 0),
      endAt: atLocalDate(now, 0, 22, 30)
    },
    {
      tableId: 2,
      createdBy: "Макс",
      gameTitle: "Warhammer 40k",
      description: "Матч на 1500 очков. Можно прийти посмотреть и обсудить листы.",
      participants: ["Макс", "Артем"],
      participantsCount: 2,
      isPrivate: false,
      openToJoin: true,
      startAt: atLocalDate(now, 2, 13, 0),
      endAt: atLocalDate(now, 2, 17, 0)
    },
    {
      tableId: 1,
      createdBy: "Вика",
      gameTitle: "Terraforming Mars",
      description: "Обычная партия, есть 1 свободное место.",
      participants: ["Вика", "Кирилл", "Антон"],
      participantsCount: 3,
      isPrivate: false,
      openToJoin: true,
      startAt: atLocalDate(now, 3, 15, 0),
      endAt: atLocalDate(now, 3, 20, 0)
    },
    {
      tableId: 2,
      createdBy: "Ника",
      gameTitle: "D&D one-shot",
      description: "Небольшой ваншот для новичков. Можно присоединиться.",
      participants: ["Ника", "Дима", "Оля", "Женя"],
      participantsCount: 4,
      isPrivate: false,
      openToJoin: true,
      startAt: atLocalDate(now, 4, 19, 0),
      endAt: atLocalDate(now, 4, 23, 0)
    }
  ];

  for (const booking of seedBookings) {
    const creator = memberByName.get(booking.createdBy);

    if (!creator) {
      continue;
    }

    await prisma.booking.create({
      data: {
        tableId: booking.tableId,
        createdByMemberId: creator.id,
        customGameTitle: booking.gameTitle,
        description: booking.description,
        startAt: booking.startAt,
        endAt: booking.endAt,
        isPrivate: booking.isPrivate,
        openToJoin: booking.openToJoin,
        participantsCount: booking.participantsCount,
        participants: {
          create: booking.participants
            .map((name) => memberByName.get(name))
            .filter((member): member is NonNullable<typeof member> => Boolean(member))
            .map((member) => ({
              memberId: member.id,
              role: member.firstName === booking.createdBy ? "organizer" : "player"
            }))
        }
      }
    });
  }
}

