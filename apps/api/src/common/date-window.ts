export function getBookingWindow(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 30);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export function isDateInsideBookingWindow(target: Date, now = new Date()) {
  const { start, end } = getBookingWindow(now);
  return target >= start && target <= end;
}

