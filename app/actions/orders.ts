"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireYardUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertPlan } from "@/lib/entitlements";
import { placeOrder, OrderError } from "@/lib/orders";
import { sendEmail, emailShell } from "@/lib/mailer";
import { trackEvent } from "@/lib/observability";
import { formatCents } from "@/lib/money";

async function ownedOrder(orderId: string) {
  const ctx = await requireYardUser();
  const order = await db.order.findUnique({ where: { id: orderId }, include: { yard: true } });
  if (!order || order.yardId !== ctx.yard.id) throw new Error("Order not found");
  return { ctx, order };
}

export async function scheduleOrder(formData: FormData): Promise<void> {
  const orderId = String(formData.get("orderId"));
  const date = String(formData.get("date") ?? "");
  const slot = String(formData.get("slot") ?? "");
  const truckId = String(formData.get("truckId") ?? "");
  const { ctx, order } = await ownedOrder(orderId);
  assertPlan(ctx.yard, "PRO"); // dispatch scheduling is a Pro feature
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Pick a date");
  if (truckId) {
    const truck = await db.truck.findUnique({ where: { id: truckId } });
    if (!truck || truck.yardId !== ctx.yard.id) throw new Error("Unknown truck");
  }

  const updated = await db.order.update({
    where: { id: orderId },
    data: {
      scheduledDate: new Date(`${date}T12:00:00Z`),
      scheduledSlot: slot === "AM" || slot === "PM" ? slot : "",
      truckId: truckId || null,
      status: order.status === "NEW" ? "SCHEDULED" : order.status,
    },
  });

  if (updated.customerEmail) {
    const dateStr = updated.scheduledDate!.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" });
    await sendEmail({
      yardId: order.yardId,
      to: updated.customerEmail,
      kind: "scheduled",
      subject: `Delivery confirmed for ${dateStr} — order #${updated.number}`,
      html: emailShell(
        "Your delivery is confirmed",
        `<p>${order.yard.name} will deliver order <strong>#${updated.number}</strong> on
         <strong>${dateStr}</strong>${updated.scheduledSlot ? ` (${updated.scheduledSlot})` : ""}.</p>
         <p>Total due on delivery: <strong>${formatCents(updated.totalCents)}</strong></p>
         <p>Questions? Call ${order.yard.phone || order.yard.name}.</p>`
      ),
    });
  }
  revalidatePath("/app", "layout");
}

export async function setOrderStatus(formData: FormData): Promise<void> {
  const orderId = String(formData.get("orderId"));
  const status = String(formData.get("status"));
  const allowed = ["NEW", "SCHEDULED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELED"];
  if (!allowed.includes(status)) throw new Error("Bad status");
  const { order } = await ownedOrder(orderId);

  const updated = await db.order.update({
    where: { id: orderId },
    data: {
      status,
      deliveredAt: status === "DELIVERED" ? new Date() : order.deliveredAt,
      canceledAt: status === "CANCELED" ? new Date() : null,
      paymentStatus:
        status === "DELIVERED" && order.paymentStatus === "PAY_ON_DELIVERY"
          ? order.paymentStatus // owner marks paid explicitly
          : order.paymentStatus,
    },
  });

  if (status === "DELIVERED" && updated.customerEmail) {
    await sendEmail({
      yardId: order.yardId,
      to: updated.customerEmail,
      kind: "delivered",
      subject: `Delivered! Order #${updated.number} — ${order.yard.name}`,
      html: emailShell(
        "Your material has been delivered",
        `<p>Order <strong>#${updated.number}</strong> was delivered today. Thanks for your business!</p>
         <p>If anything looks off, call ${order.yard.phone || "the yard"} and we'll make it right.</p>`
      ),
    });
  }
  await trackEvent("order_status_change", { yardId: order.yardId, meta: { orderId, status } });
  revalidatePath("/app", "layout");
}

export async function setPaymentStatus(formData: FormData): Promise<void> {
  const orderId = String(formData.get("orderId"));
  const paymentStatus = String(formData.get("paymentStatus"));
  const paymentMethod = String(formData.get("paymentMethod") ?? "");
  if (!["UNPAID", "PAY_ON_DELIVERY", "PAID"].includes(paymentStatus)) throw new Error("Bad status");
  await ownedOrder(orderId);
  await db.order.update({
    where: { id: orderId },
    data: { paymentStatus, paymentMethod: paymentMethod.slice(0, 40) },
  });
  revalidatePath("/app", "layout");
}

export async function saveInternalNotes(formData: FormData): Promise<void> {
  const orderId = String(formData.get("orderId"));
  const notes = String(formData.get("internalNotes") ?? "").slice(0, 2000);
  await ownedOrder(orderId);
  await db.order.update({ where: { id: orderId }, data: { internalNotes: notes } });
  revalidatePath(`/app/orders/${orderId}`);
}

export type PhoneOrderState = { error?: string };

export async function createPhoneOrder(
  _prev: PhoneOrderState,
  formData: FormData
): Promise<PhoneOrderState> {
  const ctx = await requireYardUser();

  const cart: { productId: string; qty: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("qty_")) {
      const qty = parseFloat(String(value));
      if (isFinite(qty) && qty > 0) cart.push({ productId: key.slice(4), qty });
    }
  }
  if (cart.length === 0) return { error: "Add at least one product quantity." };

  let order;
  try {
    order = await placeOrder({
      yardId: ctx.yard.id,
      channel: "PHONE",
      customerName: String(formData.get("customerName") ?? ""),
      customerPhone: String(formData.get("customerPhone") ?? ""),
      customerEmail: String(formData.get("customerEmail") ?? "") || undefined,
      addressLine: String(formData.get("addressLine") ?? ""),
      city: String(formData.get("city") ?? ""),
      zip: String(formData.get("zip") ?? ""),
      placementNotes: String(formData.get("placementNotes") ?? ""),
      internalNotes: String(formData.get("internalNotes") ?? ""),
      requestedDate: String(formData.get("requestedDate") ?? "") || undefined,
      cart,
    });
  } catch (e) {
    if (e instanceof OrderError) return { error: e.message };
    throw e;
  }
  redirect(`/app/orders/${order.id}`);
}
