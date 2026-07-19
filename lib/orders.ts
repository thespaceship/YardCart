import { db } from "./db";
import { priceCart, type CartLine } from "./pricing";
import { matchZone } from "./zones";
import { sendEmail, emailShell } from "./mailer";
import { trackEvent } from "./observability";
import { formatCents, unitLabel } from "./money";

export type PlaceOrderInput = {
  yardId: string;
  channel: "ONLINE" | "PHONE";
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  addressLine: string;
  city?: string;
  zip: string;
  placementNotes?: string;
  requestedDate?: string; // YYYY-MM-DD
  cart: CartLine[];
  paymentStatus?: string;
  internalNotes?: string;
};

export class OrderError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export async function placeOrder(input: PlaceOrderInput) {
  const yard = await db.yard.findUnique({
    where: { id: input.yardId },
    include: { zones: true, products: { where: { active: true } } },
  });
  if (!yard) throw new OrderError("yard_not_found", "Yard not found");
  if (input.channel === "ONLINE" && !yard.acceptOnlineOrders) {
    throw new OrderError("orders_paused", "This yard is not accepting online orders right now.");
  }

  const zone = matchZone(yard.zones, input.zip);
  if (input.channel === "ONLINE" && !zone) {
    throw new OrderError("out_of_area", "Sorry, that ZIP code is outside our delivery area.");
  }

  const priced = priceCart(yard.products, zone, input.cart);
  if (priced.lines.length === 0) throw new OrderError("empty_cart", "Your cart is empty.");
  if (input.channel === "ONLINE" && !priced.meetsMinOrder) {
    throw new OrderError(
      "below_minimum",
      `Minimum order for your area is ${formatCents(priced.minOrderCents)} of material.`
    );
  }

  let requestedDate: Date | null = null;
  if (input.requestedDate) {
    const d = new Date(`${input.requestedDate}T12:00:00Z`);
    if (isNaN(d.getTime())) throw new OrderError("bad_date", "Invalid requested date.");
    requestedDate = d;
  }

  const order = await db.$transaction(async (tx) => {
    const last = await tx.order.findFirst({
      where: { yardId: yard.id },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    return tx.order.create({
      data: {
        yardId: yard.id,
        number: (last?.number ?? 1000) + 1,
        channel: input.channel,
        customerName: input.customerName.trim().slice(0, 120),
        customerPhone: input.customerPhone.trim().slice(0, 40),
        customerEmail: (input.customerEmail ?? "").trim().slice(0, 200),
        addressLine: input.addressLine.trim().slice(0, 240),
        city: (input.city ?? "").trim().slice(0, 120),
        zip: input.zip.trim().slice(0, 10),
        zoneId: zone?.id ?? null,
        placementNotes: (input.placementNotes ?? "").trim().slice(0, 1000),
        internalNotes: (input.internalNotes ?? "").trim().slice(0, 1000),
        materialCents: priced.materialCents,
        deliveryCents: priced.deliveryCents,
        totalCents: priced.totalCents,
        paymentStatus: input.paymentStatus ?? (yard.paymentOnDelivery ? "PAY_ON_DELIVERY" : "UNPAID"),
        requestedDate,
        items: {
          create: priced.lines.map((l) => ({
            productId: l.productId,
            nameSnap: l.nameSnap,
            unitSnap: l.unitSnap,
            qty: l.qty,
            unitCents: l.unitCents,
            totalCents: l.totalCents,
          })),
        },
      },
      include: { items: true },
    });
  });

  await trackEvent("order_placed", {
    yardId: yard.id,
    meta: { orderId: order.id, channel: order.channel, totalCents: order.totalCents },
  });

  const itemRows = order.items
    .map(
      (i) =>
        `<tr><td style="padding:4px 8px">${i.nameSnap}</td><td style="padding:4px 8px">${i.qty} ${unitLabel(
          i.unitSnap
        )}</td><td style="padding:4px 8px;text-align:right">${formatCents(i.totalCents)}</td></tr>`
    )
    .join("");
  const totals = `<p><strong>Material:</strong> ${formatCents(order.materialCents)}<br/>
  <strong>Delivery:</strong> ${formatCents(order.deliveryCents)}<br/>
  <strong>Total:</strong> ${formatCents(order.totalCents)}</p>`;

  if (order.customerEmail) {
    await sendEmail({
      yardId: yard.id,
      to: order.customerEmail,
      kind: "order_confirmation",
      subject: `Order #${order.number} received — ${yard.name}`,
      html: emailShell(
        `Thanks, ${order.customerName.split(" ")[0]}!`,
        `<p>${yard.name} received your order <strong>#${order.number}</strong>.</p>
         <table style="border-collapse:collapse">${itemRows}</table>${totals}
         <p>Delivery to: ${order.addressLine}, ${order.zip}</p>
         ${order.requestedDate ? `<p>Requested date: ${order.requestedDate.toISOString().slice(0, 10)}</p>` : ""}
         <p>We'll confirm your delivery date shortly. Questions? Call ${yard.phone || "the yard"}.</p>`
      ),
    });
  }
  if (yard.email) {
    await sendEmail({
      yardId: yard.id,
      to: yard.email,
      kind: "new_order_alert",
      subject: `New ${order.channel === "ONLINE" ? "online " : ""}order #${order.number} — ${formatCents(order.totalCents)}`,
      html: emailShell(
        `New order #${order.number}`,
        `<p>${order.customerName} — ${order.customerPhone}</p>
         <table style="border-collapse:collapse">${itemRows}</table>${totals}
         <p>${order.addressLine}, ${order.zip}${order.placementNotes ? `<br/>Notes: ${order.placementNotes}` : ""}</p>`
      ),
    });
  }

  return order;
}
