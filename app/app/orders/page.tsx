import Link from "next/link";
import { requireYardUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCents, unitLabel } from "@/lib/money";
import StatusBadge from "@/components/StatusBadge";

export const metadata = { title: "Orders" };

const FILTERS = [
  { key: "", label: "All open" },
  { key: "NEW", label: "New" },
  { key: "SCHEDULED", label: "Scheduled" },
  { key: "OUT_FOR_DELIVERY", label: "Out" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "CANCELED", label: "Canceled" },
];

export default async function OrdersPage(props: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const ctx = await requireYardUser();
  const { status = "", q = "" } = await props.searchParams;

  const where: Record<string, unknown> = { yardId: ctx.yard.id };
  if (status) where.status = status;
  else where.status = { in: ["NEW", "SCHEDULED", "OUT_FOR_DELIVERY"] };
  if (q) {
    where.OR = [
      { customerName: { contains: q } },
      { customerPhone: { contains: q } },
      { addressLine: { contains: q } },
      { zip: { contains: q } },
    ];
  }

  const orders = await db.order.findMany({
    where,
    include: { items: true, truck: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="stack">
      <div className="spread">
        <h1 style={{ margin: 0 }}>Orders</h1>
        <Link className="btn" href="/app/orders/new">
          + Phone order
        </Link>
      </div>

      <div className="spread">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              className={`btn small ${f.key === status ? "" : "secondary"}`}
              href={f.key ? `/app/orders?status=${f.key}` : "/app/orders"}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <form method="get" action="/app/orders" style={{ display: "flex", gap: 8 }}>
          {status && <input type="hidden" name="status" value={status} />}
          <input name="q" placeholder="Search name, phone, address…" defaultValue={q} style={{ width: 240 }} />
          <button className="btn secondary small">Search</button>
        </form>
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Placed</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Delivery</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} className="muted" style={{ textAlign: "center", padding: 32 }}>
                  No orders match.
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.id}>
                <td>
                  <Link href={`/app/orders/${o.id}`}>#{o.number}</Link>
                  <div className="muted">{o.channel === "PHONE" ? "phone" : "online"}</div>
                </td>
                <td>
                  {o.createdAt.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" })}
                </td>
                <td>
                  {o.customerName}
                  <div className="muted">{o.customerPhone}</div>
                </td>
                <td style={{ maxWidth: 260 }}>
                  {o.items.map((i) => `${i.qty} ${unitLabel(i.unitSnap)} ${i.nameSnap}`).join(", ")}
                </td>
                <td>
                  {(o.scheduledDate ?? o.requestedDate)?.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" }) ?? "—"}
                  {o.scheduledSlot && <span className="muted"> {o.scheduledSlot}</span>}
                  <div className="muted">{o.truck?.name ?? ""}</div>
                </td>
                <td>{formatCents(o.totalCents)}</td>
                <td>
                  {o.paymentStatus === "PAID" ? (
                    <span className="badge delivered">Paid</span>
                  ) : o.paymentStatus === "PAY_ON_DELIVERY" ? (
                    <span className="badge neutral">On delivery</span>
                  ) : (
                    <span className="badge canceled">Unpaid</span>
                  )}
                </td>
                <td>
                  <StatusBadge status={o.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
