import { Booking, BookingParticipant, Member, Table } from "@prisma/client";

type BookingWithRelations = Booking & {
  createdByMember: Member;
  table: Table;
  participants: Array<BookingParticipant & { member: Member }>;
};

export function serializeBooking(booking: BookingWithRelations) {
  const joinedParticipants = booking.participants.filter((participant) => participant.role !== "organizer");

  return {
    id: booking.id,
    tableId: booking.tableId,
    tableName: booking.table.name,
    gameTitle: booking.customGameTitle,
    description: booking.description ?? "",
    organizer: booking.createdByMember.firstName,
    organizerUsername: booking.createdByMember.username ?? null,
    createdBy: booking.createdByMember.firstName,
    createdByTelegramUserId: booking.createdByMember.telegramUserId?.toString() ?? null,
    participants: joinedParticipants.map((participant) => ({
      memberId: participant.memberId,
      telegramUserId: participant.member.telegramUserId?.toString() ?? null,
      name: participant.member.firstName,
      username: participant.member.username ?? null,
      role: participant.role
    })),
    participantsCount: booking.participantsCount,
    joinedCount: joinedParticipants.length,
    availableSlots: Math.max(booking.participantsCount - joinedParticipants.length, 0),
    isPrivate: booking.isPrivate,
    openToJoin: booking.openToJoin,
    startAt: booking.startAt.toISOString(),
    endAt: booking.endAt.toISOString(),
    status: booking.status
  };
}
