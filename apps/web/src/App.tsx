import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { TableCard } from "./components/TableCard";
import {
  type BookingRecord,
  type CreateBookingPayload,
  type TableCurrentState,
  type TableRecord,
  cancelBooking,
  createBooking,
  fetchBooking,
  fetchBookings,
  fetchTableStates,
  fetchTables,
  joinBooking,
  leaveBooking,
  removeBookingParticipant,
  updateBooking
} from "./lib/api";
import { getTelegramUser } from "./lib/telegram";

const monthLabel = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });
const dayLabel = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", weekday: "short" });
const shortTime = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const fullDate = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  weekday: "long"
});

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isSameDay(left: Date, right: Date) {
  return startOfDay(left).getTime() === startOfDay(right).getTime();
}

function formatTimeRange(booking: BookingRecord) {
  return `${shortTime.format(new Date(booking.startAt))}-${shortTime.format(new Date(booking.endAt))}`;
}

function bookingJoinLabel(booking: Pick<BookingRecord, "isPrivate" | "openToJoin">) {
  return booking.isPrivate ? "Приватная игра" : "Можно присоединиться";
}

function bookingAudienceLabel(booking: Pick<BookingRecord, "isPrivate">) {
  return booking.isPrivate ? "Частная" : "Открытая";
}

function bookingStatusLabel(status: string) {
  if (status === "cancelled") return "Отменена";
  if (status === "completed") return "Завершена";
  return "Активна";
}

function formatMemberLabel(name: string, username?: string | null) {
  return username ? `${name} @${username}` : name;
}

function canJoinBooking(booking: Pick<BookingRecord, "status" | "isPrivate" | "openToJoin" | "availableSlots">) {
  return booking.status === "active" && !booking.isPrivate && booking.openToJoin && booking.availableSlots > 0;
}

function bookingJoinButtonLabel(booking: Pick<BookingRecord, "isPrivate" | "availableSlots">, working: boolean) {
  if (working) return "Присоединяюсь…";
  if (booking.isPrivate) return "Приватная игра";
  if (booking.availableSlots <= 0) return "Мест нет";
  return "Присоединиться к игре";
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCalendarDays(baseMonth: Date) {
  const firstDay = new Date(baseMonth.getFullYear(), baseMonth.getMonth(), 1);
  const firstWeekDay = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstWeekDay);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

function getDayOccupancy(date: Date, bookings: BookingRecord[]) {
  const totalHours = bookings
    .filter((booking) => booking.status === "active" && isSameDay(new Date(booking.startAt), date))
    .reduce(
      (sum, booking) =>
        sum + (new Date(booking.endAt).getTime() - new Date(booking.startAt).getTime()) / 36e5,
      0,
    );
  const ratio = totalHours / 18;

  if (ratio >= 0.9) return "full";
  if (ratio >= 0.6) return "high";
  if (ratio >= 0.3) return "medium";
  return "low";
}

function useClubData() {
  const [tables, setTables] = useState<TableRecord[]>([]);
  const [currentStates, setCurrentStates] = useState<TableCurrentState[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);

    const today = startOfDay(new Date());
    const until = new Date(today);
    until.setDate(until.getDate() + 60);

    try {
      const [tablesData, currentData, bookingsData] = await Promise.all([
        fetchTables(),
        fetchTableStates(),
        fetchBookings(today.toISOString(), until.toISOString())
      ]);
      setTables(tablesData);
      setCurrentStates(currentData);
      setBookings(bookingsData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  return { tables, currentStates, bookings, loading, error, reload: loadData, setBookings };
}

function Layout({ children, loading, error }: { children: ReactNode; loading: boolean; error: string | null }) {
  return (
    <main className="page-shell">
      {error ? <div className="error-banner">{error}</div> : null}
      {loading ? <div className="loading-banner">Загружаю расписание клуба…</div> : null}
      {children}
    </main>
  );
}

function HomeScreen({
  tables,
  currentStates,
  bookings
}: {
  tables: TableRecord[];
  currentStates: TableCurrentState[];
  bookings: BookingRecord[];
}) {
  const navigate = useNavigate();
  const { date } = useParams();
  const now = new Date();
  const today = startOfDay(now);
  const selectedDate = date ? new Date(`${date}T00:00:00`) : today;
  const bookingWindowEnd = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30));
  const months = useMemo(
    () => [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 1)],
    [now],
  );

  const currentByTable = new Map(currentStates.map((state) => [state.tableId, state]));
  const dayBookings = bookings
    .filter((booking) => booking.status === "active" && isSameDay(new Date(booking.startAt), selectedDate))
    .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime());

  if (Number.isNaN(selectedDate.getTime())) return <Navigate to="/" replace />;

  return (
    <>
      <section className="section-grid">
        {tables.map((table) => {
          const state = currentByTable.get(table.id);
          return (
            <TableCard
              key={table.id}
              id={table.id}
              name={table.name}
              status={state?.status === "busy" ? "busy" : "free"}
              isSelected={false}
              currentBooking={
                state?.status === "busy" && state.gameTitle && state.organizer
                  ? {
                      organizer: state.organizer,
                      gameTitle: state.gameTitle,
                      timeRange: `Сегодня ${shortTime.format(new Date(state.startAt!))}-${shortTime.format(new Date(state.endAt!))}`,
                      participants: state.participantsCount ?? 0,
                      privacyLabel: state.isPrivate ? "Приватная игра" : "Можно присоединиться"
                    }
                  : undefined
              }
              onSelect={() => navigate(`/day/${toDateInputValue(selectedDate)}`)}
            />
          );
        })}
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">День</p>
            <h2>{fullDate.format(selectedDate)}</h2>
          </div>
        </div>
        <div className="day-layout">
          {tables.map((table) => {
            const tableBookings = dayBookings.filter((booking) => booking.tableId === table.id);
            return (
              <section key={table.id} className="day-panel">
                <div className="panel__header">
                  <div>
                    <p className="eyebrow">{table.name}</p>
                    <h3>{tableBookings.length > 0 ? "Расписание стола" : "Стол свободен"}</h3>
                  </div>
                  <button type="button" className="ghost-button" onClick={() => navigate(`/booking/new?date=${toDateInputValue(selectedDate)}&tableId=${table.id}`)}>
                    Забронировать стол
                  </button>
                </div>

                <div className="schedule-list">
                  {tableBookings.length > 0 ? tableBookings.map((booking) => (
                    <button key={booking.id} type="button" className="schedule-card" onClick={() => navigate(`/booking/${booking.id}`)}>
                      <div className="schedule-card__top">
                        <strong>{formatTimeRange(booking)}</strong>
                        <span className={booking.isPrivate ? "audience-label audience-label--private" : "audience-label audience-label--open"}>
                          {bookingAudienceLabel(booking)}
                        </span>
                      </div>
                      <h3>{booking.gameTitle}</h3>
                      <p>{formatMemberLabel(booking.organizer, booking.organizerUsername)}</p>
                      <p>{`${booking.joinedCount}/${booking.participantsCount} мест`}</p>
                    </button>
                  )) : <div className="empty-state">На этот день броней нет. Можно создать новую бронь для этого стола.</div>}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Календарь</p>
            <h2>Текущий и следующий месяц</h2>
          </div>
          <div className="legend">
            <span><i className="legend__dot legend__dot--low" />Свободно</span>
            <span><i className="legend__dot legend__dot--medium" />Средняя загрузка</span>
            <span><i className="legend__dot legend__dot--high" />Плотно</span>
            <span><i className="legend__dot legend__dot--full" />Все занято</span>
          </div>
        </div>
        <div className="months-grid">
          {months.map((month) => (
            <section key={month.toISOString()} className="month-card">
              <div className="month-card__header">
                <h3>{monthLabel.format(month)}</h3>
              </div>
              <div className="weekdays">
                {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="month-grid">
                {getCalendarDays(month).map((date) => {
                  const isCurrentMonth = date.getMonth() === month.getMonth();
                  const isPast = startOfDay(date) < today;
                  const isWindowLocked = startOfDay(date) > bookingWindowEnd;
                  const occupancy = getDayOccupancy(date, bookings);
                  const count = bookings.filter((booking) => booking.status === "active" && isSameDay(new Date(booking.startAt), date)).length;

                  return (
                    <button
                      key={date.toISOString()}
                      type="button"
                      className={["day-cell", `day-cell--${occupancy}`, isCurrentMonth ? "" : "day-cell--outside", isPast || isWindowLocked ? "day-cell--locked" : "", isSameDay(date, selectedDate) ? "day-cell--selected" : ""].join(" ")}
                      onClick={() => navigate(`/day/${toDateInputValue(date)}`)}
                    >
                      <span className="day-cell__number">{date.getDate()}</span>
                      <span className="day-cell__count">{count > 0 ? `${count} брон.` : ""}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </section>
    </>
  );
}

function BookingForm({
  mode,
  initialBooking,
  onSaved
}: {
  mode: "create" | "edit";
  initialBooking?: BookingRecord;
  onSaved: (booking: BookingRecord) => void;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tableId = initialBooking?.tableId ?? Number(searchParams.get("tableId") ?? "1");
  const date = initialBooking ? toDateInputValue(new Date(initialBooking.startAt)) : searchParams.get("date") ?? toDateInputValue(new Date());
  const [form, setForm] = useState({
    gameTitle: initialBooking?.gameTitle ?? "Новая игра",
    startTime: initialBooking ? shortTime.format(new Date(initialBooking.startAt)) : "19:00",
    endTime: initialBooking ? shortTime.format(new Date(initialBooking.endAt)) : "22:00",
    participantsCount: String(initialBooking?.participantsCount ?? 4),
    isPrivate: initialBooking?.isPrivate ?? false,
    description: initialBooking?.description ?? "Описание партии или сессии DnD."
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const payload: CreateBookingPayload = {
      tableId,
      date,
      startTime: form.startTime,
      endTime: form.endTime,
      gameTitle: form.gameTitle,
      description: form.description,
      participantsCount: Number(form.participantsCount),
      isPrivate: form.isPrivate
    };

    try {
      const booking =
        mode === "create" ? await createBooking(payload) : await updateBooking(initialBooking!.id, payload);
      onSaved(booking);
      navigate(`/booking/${booking.id}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Не удалось сохранить бронь");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <header className="screen-header">
        <button type="button" className="ghost-button" onClick={() => navigate(`/day/${date}`)}>
          Назад к дню
        </button>
        <div>
          <h1>{mode === "create" ? `Новая бронь · Стол ${tableId}` : `Редактирование · ${initialBooking?.gameTitle ?? ""}`}</h1>
        </div>
      </header>

      <section className="booking-screen">
        <form className="panel booking-form-panel" onSubmit={handleSubmit}>
          {submitError ? <div className="error-banner">{submitError}</div> : null}
          <div className="detail-row"><span>Дата</span><strong>{fullDate.format(new Date(`${date}T00:00:00`))}</strong></div>
          <div className="detail-row"><span>Стол</span><strong>{`Стол ${tableId}`}</strong></div>
          <div className="form-grid">
            <label className="field">
              <span>Игра</span>
              <input value={form.gameTitle} onChange={(event) => setForm({ ...form, gameTitle: event.target.value })} />
            </label>
            <label className="field">
              <span>Время начала</span>
              <input value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} />
            </label>
            <label className="field">
              <span>Время конца</span>
              <input value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} />
            </label>
            <label className="field">
              <span>Сколько мест в игре</span>
              <input value={form.participantsCount} onChange={(event) => setForm({ ...form, participantsCount: event.target.value })} />
            </label>
            <label className="field field--wide">
              <span>Описание</span>
              <textarea value={form.description} rows={5} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </label>
          </div>

          <div className="privacy-switch">
            <button type="button" className={`privacy-switch__option ${!form.isPrivate ? "privacy-switch__option--active" : ""}`} onClick={() => setForm({ ...form, isPrivate: false })}>
              Можно присоединиться
            </button>
            <button type="button" className={`privacy-switch__option ${form.isPrivate ? "privacy-switch__option--active" : ""}`} onClick={() => setForm({ ...form, isPrivate: true })}>
              Приватная игра
            </button>
          </div>

          <div className="actions-row">
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? "Сохраняю…" : mode === "create" ? "Создать бронь" : "Сохранить изменения"}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}

function BookingEditScreen({
  currentUserId,
  currentUserName,
  onSaved
}: {
  currentUserId: string | null;
  currentUserName: string;
  onSaved: (booking: BookingRecord) => void;
}) {
  const { bookingId } = useParams();
  const [booking, setBooking] = useState<BookingRecord | null>(null);

  useEffect(() => {
    if (!bookingId) return;
    void fetchBooking(Number(bookingId)).then(setBooking);
  }, [bookingId]);

  if (!booking) return <div className="loading-banner">Загружаю бронь…</div>;
  if ((booking.createdByTelegramUserId ?? null) !== currentUserId && !(booking.createdByTelegramUserId == null && booking.createdBy === currentUserName)) {
    return <Navigate to={`/booking/${booking.id}`} replace />;
  }

  return <BookingForm mode="edit" initialBooking={booking} onSaved={onSaved} />;
}

function BookingViewScreen({
  currentUserId,
  currentUserName,
  onChanged
}: {
  currentUserId: string | null;
  currentUserName: string;
  onChanged: (booking: BookingRecord | null, removedId?: number) => void;
}) {
  const navigate = useNavigate();
  const { bookingId } = useParams();
  const [booking, setBooking] = useState<BookingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [working, setWorking] = useState<"join" | "cancel" | "leave" | `remove:${number}` | null>(null);

  useEffect(() => {
    if (!bookingId) return;
    setLoading(true);
    void fetchBooking(Number(bookingId))
      .then(setBooking)
      .finally(() => setLoading(false));
  }, [bookingId]);

  if (loading) return <div className="loading-banner">Загружаю бронь…</div>;
  if (!booking) return <Navigate to="/" replace />;

  const currentBooking = booking;
  const canEdit =
    currentBooking.createdByTelegramUserId === currentUserId
    || (currentBooking.createdByTelegramUserId == null && currentBooking.createdBy === currentUserName);
  const currentParticipant = currentUserId
    ? currentBooking.participants.find((participant) => participant.telegramUserId === currentUserId)
    : null;
  const canJoin = !canEdit && !currentParticipant && canJoinBooking(currentBooking);
  const canLeave = !canEdit && Boolean(currentParticipant) && currentBooking.status === "active";

  async function handleJoin() {
    setWorking("join");
    setActionError(null);
    try {
      const updated = await joinBooking(currentBooking.id);
      setBooking(updated);
      onChanged(updated);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось присоединиться");
    } finally {
      setWorking(null);
    }
  }

  async function handleLeave() {
    setWorking("leave");
    setActionError(null);
    try {
      const updated = await leaveBooking(currentBooking.id);
      setBooking(updated);
      onChanged(updated);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось выйти из игры");
    } finally {
      setWorking(null);
    }
  }

  async function handleCancel() {
    setWorking("cancel");
    setActionError(null);
    try {
      await cancelBooking(currentBooking.id);
      onChanged(null, currentBooking.id);
      navigate(`/day/${toDateInputValue(new Date(currentBooking.startAt))}`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось отменить бронь");
    } finally {
      setWorking(null);
    }
  }

  async function handleRemoveParticipant(memberId: number) {
    setWorking(`remove:${memberId}`);
    setActionError(null);
    try {
      const updated = await removeBookingParticipant(currentBooking.id, memberId);
      setBooking(updated);
      onChanged(updated);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось обновить состав");
    } finally {
      setWorking(null);
    }
  }

  return (
    <>
      <header className="screen-header">
        <button type="button" className="ghost-button" onClick={() => navigate(`/day/${toDateInputValue(new Date(booking.startAt))}`)}>
          Назад к дню
        </button>
        <div>
          <h1>{booking.gameTitle}</h1>
        </div>
      </header>

      <section className="booking-screen">
        <section className="panel booking-form-panel">
          {actionError ? <div className="error-banner">{actionError}</div> : null}
          <div className="detail-row"><span>Стол</span><strong>{booking.tableName}</strong></div>
          <div className="detail-row"><span>Когда</span><strong>{fullDate.format(new Date(booking.startAt))}, {formatTimeRange(booking)}</strong></div>
          <div className="detail-row"><span>Организатор</span><strong>{formatMemberLabel(booking.organizer, booking.organizerUsername)}</strong></div>
          <div className="detail-row"><span>Статус брони</span><strong>{bookingStatusLabel(booking.status)}</strong></div>
          <div className="detail-row"><span>Формат игры</span><strong>{bookingJoinLabel(booking)}</strong></div>
          <div className="detail-row"><span>Места</span><strong>{`${booking.joinedCount}/${booking.participantsCount} занято · ${booking.availableSlots} свободно`}</strong></div>
          <p className="booking-detail__description">{booking.description}</p>
          <div className="participants">
            {booking.participants.length > 0 ? booking.participants.map((participant) => (
              <div key={participant.memberId} className="participant-row">
                <span className="participant-chip">{formatMemberLabel(participant.name, participant.username)}</span>
                {canEdit && booking.status === "active" ? (
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={working === `remove:${participant.memberId}`}
                    onClick={() => void handleRemoveParticipant(participant.memberId)}
                  >
                    {working === `remove:${participant.memberId}` ? "Убираю…" : "Убрать"}
                  </button>
                ) : null}
              </div>
            )) : <span className="participant-chip">Пока никто не присоединился</span>}
          </div>
          <div className="actions-row">
            {canEdit ? (
              <>
                <button type="button" className="primary-button" onClick={() => navigate(`/booking/${booking.id}/edit`)}>Редактировать бронь</button>
                <button type="button" className="ghost-button" disabled={booking.status !== "active" || working === "cancel"} onClick={() => void handleCancel()}>
                  {working === "cancel" ? "Отменяю…" : "Отменить бронь"}
                </button>
              </>
            ) : null}
            {canJoin ? (
              <button type="button" className="primary-button" disabled={working === "join"} onClick={() => void handleJoin()}>
                {bookingJoinButtonLabel(booking, working === "join")}
              </button>
            ) : null}
            {canLeave ? (
              <button type="button" className="ghost-button" disabled={working === "leave"} onClick={() => void handleLeave()}>
                {working === "leave" ? "Выхожу…" : "Выйти из игры"}
              </button>
            ) : null}
          </div>
        </section>
      </section>
    </>
  );
}

export function App() {
  const telegramUser = getTelegramUser();
  const currentUserName = telegramUser?.first_name ?? "Саша";
  const currentUserId = telegramUser?.id ? String(telegramUser.id) : null;
  const { tables, currentStates, bookings, loading, error, reload, setBookings } = useClubData();

  function upsertBooking(booking: BookingRecord) {
    setBookings((current) => {
      const next = current.some((item) => item.id === booking.id) ? current.map((item) => (item.id === booking.id ? booking : item)) : [...current, booking];
      return next.sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime());
    });
    void reload();
  }

  function removeBooking(id: number) {
    setBookings((current) => current.filter((item) => item.id !== id));
    void reload();
  }

  return (
    <Layout loading={loading} error={error}>
      <Routes>
        <Route path="/" element={<HomeScreen tables={tables} currentStates={currentStates} bookings={bookings} />} />
        <Route path="/day/:date" element={<HomeScreen tables={tables} currentStates={currentStates} bookings={bookings} />} />
        <Route path="/booking/new" element={<BookingForm mode="create" onSaved={upsertBooking} />} />
        <Route path="/booking/:bookingId/edit" element={<BookingEditScreen currentUserId={currentUserId} currentUserName={currentUserName} onSaved={upsertBooking} />} />
        <Route path="/booking/:bookingId" element={<BookingViewScreen currentUserId={currentUserId} currentUserName={currentUserName} onChanged={(booking, removedId) => {
          if (removedId) removeBooking(removedId);
          if (booking) upsertBooking(booking);
        }} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
