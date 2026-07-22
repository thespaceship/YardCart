import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatCents, unitLabel } from "@/lib/money";

export const metadata = { title: "Order received" };

export default async function ThanksPage(props: {
  params: Promise<{ slug: string; orderId: string }>;
}) {
  const { slug, orderId } = await props.params;
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true, yard: { select: { slug: true, name: true, phone: true } } },
  });
  if (!order || order.yard.slug !== slug) notFound();

  return (
    <div className="narrow" style={{ paddingTop: 56, paddingBottom: 56 }}>
      <div className="card">
        <h1>Order received 🎉</h1>
        <p>
          Thanks, {order.customerName.split(" ")[0]}! <strong>{order.yard.name}</strong> has your
          order <strong>#{order.number}</strong>
          {order.requestedDate && (
            <>
              {" "}
              requested for{" "}
              <strong>
                {order.requestedDate.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" })}
              </strong>
            </>
          )}
          . They&apos;ll confirm your delivery{order.customerEmail ? " by email" : ""} shortly.
        </p>
        <table>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.id}>
                <td>
                  {i.nameSnap}
                  <span className="muted">
                    {" "}
                    — {i.qty} {unitLabel(i.unitSnap)}
                  </span>
                </td>
                <td className="right">{formatCents(i.totalCents)}</td>
              </tr>
            ))}
            <tr>
              <td>
                Delivery
                {order.deliveryMethodSnap && ` — ${order.deliveryMethodSnap}`}
                {order.tripCount > 1 && ` (${order.tripCount} trips)`}
              </td>
              <td className="right">{formatCents(order.deliveryCents)}</td>
            </tr>
            <tr>
              <td>
                <strong>Total (pay on delivery)</strong>
              </td>
              <td className="right">
                <strong>{formatCents(order.totalCents)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
        <p className="muted" style={{ marginTop: 16 }}>
          Delivering to: {order.addressLine}, {order.zip}
          {order.placementNotes && (
            <>
              <br />
              Instructions: {order.placementNotes}
            </>
          )}
        </p>
        <p style={{ marginTop: 16 }}>
          Questions? Call{" "}
          <a href={`tel:${order.yard.phone}`}>{order.yard.phone || order.yard.name}</a>.
        </p>
      </div>
      <p className="muted" style={{ textAlign: "center", marginTop: 16 }}>
        <Link href={`/s/${slug}`}>← Back to {order.yard.name}</Link>
      </p>
    </div>
  );
}
