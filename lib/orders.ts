import { Prisma } from "@prisma/client";
import { db } from "./db";
import { isDemoSlug } from "./demo";
import { priceCart, type CartLine } from "./pricing";
import { matchZone } from "./zones";
import { sendEmail, emailShell, escapeHtml } from "./mailer";
import { trackEvent } from "./observability";
import { formatCents, unitLabel } from "./money";
import { yardActive } from "./billing";
import { availableDates, computeDayLoads, horizonKeys } from "./capacity";
import { localNow, keyToStoredDate } from "./tz";

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

/** Merge duplicate product lines so 50 rows of the same product can't dodge maxQty. */
function dedupeCart(cart: CartLine[]): CartLine[] {
  const merged = new Map<string, number>();
  for (const line of cart) {
    merged.set(line.productId, (merged.get(line.productId) ?? 0) + line.qty);
  }
  return [...merged.entries()].map(([productId, qty]) => ({ productId, qty }));
}

export async function placeOrder(input: PlaceOrderInput) {
  const yard = await db.yard.findUnique({
    where: { id: input.yardId },
    include: {
      zones: true,
      products: { where: { active: true } },
      trucks: { where: { active: true } },
    },
  });
  if (!yard) throw new OrderError("yard_not_found", "Yard not found");
  // Belt-and-suspenders: the storefront API already short-circuits demo checkouts with a
  // simulated success, so a real order against the demo yard must never reach this point.
  if (input.channel === "ONLINE" && isDemoSlug(yard.slug)) {
    throw new OrderError("demo_yard", "This is a demo storefront — orders here are simulated.");
  }
  if (input.channel === "ONLINE" && !yard.acceptOnlineOrders) {
    throw new OrderError("orders_paused", "This yard is not accepting online orders right now.");
  }
  if (input.channel === "ONLINE" && !yardActive(yard)) {
    // trial expired / subscription lapsed → storefront politely closed
    throw new OrderError("orders_paused", "Online ordering is unavailable right now — please call the yard.");
  }

  const zone = matchZone(yard.zones, input.zip);
  if (input.channel === "ONLINE" && !zone) {
    throw new OrderError("out_of_area", "Sorry, that ZIP code is outside our delivery area.");
  }

  const priced = priceCart(yard.products, zone, dedupeCart(input.cart));
  if (priced.lines.length === 0) throw new OrderError("empty_cart", "Your cart is empty.");
  if (input.channel === "ONLINE" && !priced.meetsMinOrder) {
    throw new OrderError(
      "below_minimum",
      `Minimum order for your area is ${formatCents(priced.minOrderCents)} of material.`
    );
  }

  let requestedDate: Date | null = null;
  if (input.requestedDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.requestedDate)) {
      throw new OrderError("bad_date", "Invalid requested date.");
    }
    requestedDate = keyToStoredDate(input.requestedDate);
    if (isNaN(requestedDate.getTime())) throw new OrderError("bad_date", "Invalid requested date.");
  }

  // Server-side availability enforcement for online orders: the requested date must be
  // one the yard could actually serve (lead time, window, remaining truck capacity).
  if (input.channel === "ONLINE") {
    if (!input.requestedDate) throw new OrderError("bad_date", "Please pick a delivery date.");
    const now = localNow(yard.timezone);
    const horizon = horizonKeys(now, yard.maxAdvanceDays + 1);
    const openOrders = await db.order.findMany({
      where: { yardId: yard.id, status: { in: ["NEW", "SCHEDULED", "OUT_FOR_DELIVERY"] } },
      include: { items: { select: { unitSnap: true, qty: true } } },
    });
    const loads = computeDayLoads(openOrders, yard.trucks, horizon);
    const ok = availableDates({
      now,
      minLeadDays: yard.minLeadDays,
      maxAdvanceDays: yard.maxAdvanceDays,
      orderCutoffHour: yard.orderCutoffHour,
      neededYards: priced.totalYards,
      dayLoads: loads,
    });
    if (!ok.includes(input.requestedDate)) {
      throw new OrderError(
        "date_unavailable",
        "That delivery date just filled up — please pick another date."
      );
    }
  }

  const orderData = {
    yardId: yard.id,
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
  };

  // Per-yard sequential numbering with retry: concurrent checkouts can collide on the
  // (yardId, number) unique constraint (esp. on Postgres); retry re-reads the max.
  let order: Prisma.OrderGetPayload<{ include: { items: true } }> | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const last = await db.order.findFirst({
      where: { yardId: yard.id },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    try {
      order = await db.order.create({
        data: { ...orderData, number: (last?.number ?? 1000) + 1 },
        include: { items: true },
      });
      break;
    } catch (e) {
      const isUniqueViolation =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!isUniqueViolation || attempt === 3) throw e;
    }
  }
  if (!order) throw new OrderError("server_error", "Could not create the order.");

  await trackEvent("order_placed", {
    yardId: yard.id,
    meta: { orderId: order.id, channel: order.channel, totalCents: order.totalCents },
  });

  const safeName = escapeHtml(order.customerName);
  const itemRows = order.items
    .map(
      (i) =>
        `<tr><td style="padding:4px 8px">${escapeHtml(i.nameSnap)}</td><td style="padding:4px 8px">${i.qty} ${unitLabel(
          i.unitSnap
        )}</td><td style="padding:4px 8px;text-align:right">${formatCents(i.totalCents)}</td></tr>`
    )
    .join("");
  const totals = `<p><strong>Material:</strong> ${formatCents(order.materialCents)}<br/>
  <strong>Delivery:</strong> ${formatCents(order.deliveryCents)}<br/>
  <strong>Total:</strong> ${formatCents(order.totalCents)}</p>`;
  const safeAddress = `${escapeHtml(order.addressLine)}, ${escapeHtml(order.zip)}`;

  if (order.customerEmail) {
    await sendEmail({
      yardId: yard.id,
      to: order.customerEmail,
      kind: "order_confirmation",
      subject: `Order #${order.number} received — ${yard.name}`,
      html: emailShell(
        `Thanks, ${escapeHtml(order.customerName.split(" ")[0])}!`,
        `<p>${escapeHtml(yard.name)} received your order <strong>#${order.number}</strong>.</p>
         <table style="border-collapse:collapse">${itemRows}</table>${totals}
         <p>Delivery to: ${safeAddress}</p>
         ${order.requestedDate ? `<p>Requested date: ${order.requestedDate.toISOString().slice(0, 10)}</p>` : ""}
         <p>We'll confirm your delivery date shortly. Questions? Call ${escapeHtml(yard.phone || "the yard")}.</p>`
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
        `<p>${safeName} — ${escapeHtml(order.customerPhone)}</p>
         <table style="border-collapse:collapse">${itemRows}</table>${totals}
         <p>${safeAddress}${order.placementNotes ? `<br/>Notes: ${escapeHtml(order.placementNotes)}` : ""}</p>`
      ),
    });
  }

  return order;
}
