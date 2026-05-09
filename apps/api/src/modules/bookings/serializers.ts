import { Booking, BookingParticipant, Member, Table } from "@prisma/client";

type BookingWithRelations = Booking & {
  createdByMember: Member;
  table: Table;
  participants: Array<BookingParticipant & { member: Member }>;
};

export function serializeBooking(booking: BookingWithRelations) {
  return {
    id: booking.id,
    tableId: booking.tableId,
    tableName: booking.table.name,
    gameTitle: booking.customGameTitle,
    description: booking.description ?? "",
    organizer: booking.createdByMember.firstName,
    createdBy: booking.createdByMember.firstName,
    createdByTelegramUserId: booking.createdByMember.telegramUserId?.toString() ?? null,
    participants: booking.participants
      .filter((participant) => participant.role !== "organizer")
      .map((participant) => participant.member.firstName),
    participantsCount: booking.participantsCount,
    isPrivate: booking.isPrivate,
    openToJoin: booking.openToJoin,
    startAt: booking.startAt.toISOString(),
    endAt: booking.endAt.toISOString(),
    status: booking.status
  };
}
