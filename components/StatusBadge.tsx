const MAP: Record<string, { cls: string; label: string }> = {
  NEW: { cls: "new", label: "New" },
  SCHEDULED: { cls: "scheduled", label: "Scheduled" },
  OUT_FOR_DELIVERY: { cls: "out", label: "Out for delivery" },
  DELIVERED: { cls: "delivered", label: "Delivered" },
  CANCELED: { cls: "canceled", label: "Canceled" },
};

export default function StatusBadge({ status }: { status: string }) {
  const m = MAP[status] ?? { cls: "neutral", label: status };
  return <span className={`badge ${m.cls}`}>{m.label}</span>;
}
