import { getTelegramInitData } from "./telegram";

export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:4000/api";

export type TableRecord = {
  id: number;
  name: string;
  isActive: boolean;
};

export type TableCurrentState = {
  tableId: number;
  tableName: string;
  status: "free" | "busy";
  gameTitle?: string;
  organizer?: string;
  startAt?: string;
  endAt?: string;
  participantsCount?: number;
  isPrivate?: boolean;
  openToJoin?: boolean;
};

export type BookingRecord = {
  id: number;
  tableId: number;
  tableName: string;
  gameTitle: string;
  description: string;
  organizer: string;
  createdBy: string;
  createdByTelegramUserId: string | null;
  participants: string[];
  participantsCount: number;
  isPrivate: boolean;
  openToJoin: boolean;
  startAt: string;
  endAt: string;
  status: string;
};

export type MemberRecord = {
  id: number;
  firstName: string;
  username?: string | null;
  isAdmin: boolean;
};

export type CreateBookingPayload = {
  tableId: number;
  date: string;
  startTime: string;
  endTime: string;
  gameTitle: string;
  description: string;
  participantsCount: number;
  isPrivate: boolean;
};

export type UpdateBookingPayload = CreateBookingPayload;

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const telegramInitData = getTelegramInitData();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(telegramInitData ? { "X-Telegram-Init-Data": telegramInitData } : {}),
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errorBody?.error ?? `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function fetchTables() {
  return apiRequest<TableRecord[]>("/tables");
}

export function fetchTableStates() {
  return apiRequest<TableCurrentState[]>("/tables/current");
}

export async function fetchBookings(from?: string, to?: string) {
  const search = new URLSearchParams();
  if (from) {
    search.set("from", from);
  }
  if (to) {
    search.set("to", to);
  }
  const query = search.toString() ? `?${search.toString()}` : "";
  const response = await apiRequest<{ items: BookingRecord[] }>(`/bookings${query}`);
  return response.items;
}

export function fetchBooking(id: number) {
  return apiRequest<BookingRecord>(`/bookings/${id}`);
}

export async function fetchMembers() {
  const response = await apiRequest<{ items: MemberRecord[] }>("/members");
  return response.items;
}

export function createBooking(payload: CreateBookingPayload) {
  return apiRequest<BookingRecord>("/bookings", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateBooking(id: number, payload: UpdateBookingPayload) {
  return apiRequest<BookingRecord>(`/bookings/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function cancelBooking(id: number) {
  return apiRequest<BookingRecord>(`/bookings/${id}/cancel`, {
    method: "POST"
  });
}

export function joinBooking(id: number) {
  return apiRequest<BookingRecord>(`/bookings/${id}/join`, {
    method: "POST"
  });
}
