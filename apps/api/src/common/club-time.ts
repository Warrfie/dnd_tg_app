const CLUB_UTC_OFFSET_HOURS = 7;
const CLUB_UTC_OFFSET_MINUTES = CLUB_UTC_OFFSET_HOURS * 60;

function pad(value: number) {
  return `${value}`.padStart(2, "0");
}

function shiftToClubTime(date: Date) {
  return new Date(date.getTime() + CLUB_UTC_OFFSET_MINUTES * 60_000);
}

export function formatClubDate(date: Date) {
  const clubDate = shiftToClubTime(date);
  return `${clubDate.getUTCFullYear()}-${pad(clubDate.getUTCMonth() + 1)}-${pad(clubDate.getUTCDate())}`;
}

export function parseClubDateTime(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);

  return new Date(Date.UTC(year, month - 1, day, hours - CLUB_UTC_OFFSET_HOURS, minutes, 0, 0));
}

export function atClubDate(base: Date, addDaysCount: number, hours: number, minutes = 0) {
  const baseDate = shiftToClubTime(base);
  return new Date(
    Date.UTC(
      baseDate.getUTCFullYear(),
      baseDate.getUTCMonth(),
      baseDate.getUTCDate() + addDaysCount,
      hours - CLUB_UTC_OFFSET_HOURS,
      minutes,
      0,
      0
    )
  );
}
