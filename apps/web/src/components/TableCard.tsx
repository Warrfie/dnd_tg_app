type BookingPreview = {
  organizer: string;
  gameTitle: string;
  timeRange: string;
  participants: number;
  privacyLabel: string;
};

type TableCardProps = {
  id: number;
  name: string;
  status: "free" | "busy";
  isSelected: boolean;
  currentBooking?: BookingPreview;
  onSelect: (tableId: number) => void;
};

export function TableCard({ id, name, status, isSelected, currentBooking, onSelect }: TableCardProps) {
  return (
    <button
      type="button"
      className={`table-card ${isSelected ? "table-card--selected" : ""}`}
      onClick={() => onSelect(id)}
    >
      <div className="table-card__header">
        <div>
          <p className="eyebrow">{name}</p>
          <h2>{status === "busy" ? "Занят" : "Свободен"}</h2>
        </div>
        <span className={`status-pill status-pill--${status}`}>{status === "busy" ? "Занят" : "Свободен"}</span>
      </div>

      {currentBooking ? (
        <div className="table-card__content">
          <strong>{currentBooking.gameTitle}</strong>
          <p>{currentBooking.timeRange}</p>
          <p>{`${currentBooking.organizer} · ${currentBooking.privacyLabel}`}</p>
        </div>
      ) : null}
    </button>
  );
}
