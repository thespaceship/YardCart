"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { formatCents, unitLabel } from "@/lib/money";
import StatusBadge from "@/components/StatusBadge";

type OrderWithRelations = Prisma.OrderGetPayload<{ include: { items: true; truck: true } }>;

export default function OrderRow({ order: o }: { order: OrderWithRelations }) {
  const router = useRouter();
  const href = `/app/orders/${o.id}`;

  return (
    <tr className="clickable-row" onClick={() => router.push(href)}>
      <td>
        <Link href={href} style={{ fontWeight: 700, textDecoration: "underline" }}>
          #{o.number}
        </Link>
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
  );
}
