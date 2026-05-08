import { isDateInsideBookingWindow } from "../../common/date-window.js";

export function assertBookingRules(startAt: Date, endAt: Date) {
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    throw new Error("Invalid booking date");
  }

  if (endAt <= startAt) {
    throw new Error("Booking end time must be after start time");
  }

  if (startAt < new Date()) {
    throw new Error("Past time slots cannot be booked");
  }

  if (!isDateInsideBookingWindow(startAt)) {
    throw new Error("Booking start date is outside the 30-day booking window");
  }
}

