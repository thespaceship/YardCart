import { NextResponse } from "next/server";
import { requireYardUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { meetsPlan } from "@/lib/entitlements";

function csvEscape(v: string | number): string {
  let s = String(v);
  // formula-injection guard: neutralize leading = + - @ so spreadsheet apps
  // don't execute customer-supplied text as formulas
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** QuickBooks-importable sales CSV of delivered orders (last 90 days). */
export async function GET() {
  const ctx = await requireYardUser();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!meetsPlan(ctx.yard, "PRO")) {
    return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
  }

  const orders = await db.order.findMany({
    where: {
      yardId: ctx.yard.id,
      status: "DELIVERED",
      deliveredAt: { gte: new Date(Date.now() - 90 * 864e5) },
    },
    include: { items: true },
    orderBy: { deliveredAt: "asc" },
  });

  const rows: string[] = [
    ["InvoiceNo", "Customer", "InvoiceDate", "DueDate", "Item", "ItemQuantity", "ItemRate", "ItemAmount", "DeliveryFee", "Total", "PaymentMethod"].join(","),
  ];
  for (const o of orders) {
    const date = (o.deliveredAt ?? o.createdAt).toISOString().slice(0, 10);
    o.items.forEach((i, idx) => {
      rows.push(
        [
          csvEscape(o.number),
          csvEscape(o.customerName),
          date,
          date,
          csvEscape(i.nameSnap),
          i.qty,
          (i.unitCents / 100).toFixed(2),
          (i.totalCents / 100).toFixed(2),
          idx === 0 ? (o.deliveryCents / 100).toFixed(2) : "",
          idx === 0 ? (o.totalCents / 100).toFixed(2) : "",
          idx === 0 ? csvEscape(o.paymentMethod || "on_delivery") : "",
        ].join(",")
      );
    });
  }

  return new NextResponse(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="yardcart-sales-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
