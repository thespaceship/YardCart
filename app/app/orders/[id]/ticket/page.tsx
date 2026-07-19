import { notFound } from "next/navigation";
import { requireYardUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCents, unitLabel } from "@/lib/money";
import PrintButton from "@/components/PrintButton";

export const metadata = { title: "Delivery ticket" };

export default async function TicketPage(props: { params: Promise<{ id: string }> }) {
  const ctx = await requireYardUser();
  const { id } = await props.params;
  const order = await db.order.findUnique({
    where: { id },
    include: { items: true, truck: true, yard: true },
  });
  if (!order || order.yardId !== ctx.yard.id) notFound();

  return (
    <div className="narrow" style={{ paddingTop: 24 }}>
      <div className="no-print" style={{ marginBottom: 16, display: "flex", gap: 8 }}>
        <a className="btn secondary" href={`/app/orders/${order.id}`}>
          ← Back
        </a>
        <PrintButton />
      </div>
      <div className="card" style={{ fontSize: "1.05rem" }}>
        <div className="spread">
          <div>
            <h2 style={{ margin: 0 }}>{order.yard.name}</h2>
            <div className="muted">{order.yard.phone}</div>
          </div>
          <div className="right">
            <h2 style={{ margin: 0 }}>Ticket #{order.number}</h2>
            <div className="muted">
              {(order.scheduledDate ?? order.requestedDate)?.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" })}
              {order.scheduledSlot && ` · ${order.scheduledSlot}`}
              {order.truck && ` · ${order.truck.name}`}
            </div>
          </div>
        </div>
        <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: "16px 0" }} />
        <p>
          <strong style={{ fontSize: "1.2rem" }}>{order.customerName}</strong>
          <br />
          <strong style={{ fontSize: "1.2rem" }}>
            {order.addressLine}
            {order.city ? `, ${order.city}` : ""} {order.zip}
          </strong>
          <br />
          {order.customerPhone}
        </p>
        {order.placementNotes && (
          <p
            style={{
              border: "2px solid var(--ink)",
              borderRadius: 8,
              padding: "10px 14px",
              fontWeight: 700,
            }}
          >
            PLACEMENT: {order.placementNotes}
          </p>
        )}
        <table style={{ margin: "12px 0" }}>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.id}>
                <td style={{ fontSize: "1.15rem", fontWeight: 700 }}>
                  {i.qty} {unitLabel(i.unitSnap)} — {i.nameSnap}
                </td>
                <td className="right">{formatCents(i.totalCents)}</td>
              </tr>
            ))}
            <tr>
              <td>Delivery</td>
              <td className="right">{formatCents(order.deliveryCents)}</td>
            </tr>
          </tbody>
        </table>
        <p style={{ fontSize: "1.3rem" }}>
          <strong>
            {order.paymentStatus === "PAID"
              ? `PAID (${order.paymentMethod || "—"})`
              : `COLLECT ON DELIVERY: ${formatCents(order.totalCents)}`}
          </strong>
        </p>
        <div style={{ marginTop: 40, display: "flex", gap: 40 }}>
          <div style={{ flex: 1, borderTop: "1px solid var(--ink)", paddingTop: 4 }}>
            Driver signature
          </div>
          <div style={{ flex: 1, borderTop: "1px solid var(--ink)", paddingTop: 4 }}>
            Customer (if present)
          </div>
        </div>
      </div>
    </div>
  );
}
