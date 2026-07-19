"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireYardUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dollarsToCents } from "@/lib/money";
import { parseZipList } from "@/lib/zones";

async function ctxOrLogin() {
  const ctx = await requireYardUser();
  return ctx;
}

// ---------- Products ----------

export async function upsertProduct(formData: FormData): Promise<void> {
  const ctx = await ctxOrLogin();
  const id = String(formData.get("id") ?? "");
  const data = {
    name: String(formData.get("name") ?? "").trim().slice(0, 120),
    category: String(formData.get("category") ?? "other"),
    description: String(formData.get("description") ?? "").trim().slice(0, 500),
    unit: String(formData.get("unit") ?? "cubic_yard"),
    priceCents: dollarsToCents(String(formData.get("price") ?? "0")),
    minQty: Math.max(0.5, parseFloat(String(formData.get("minQty") ?? "1")) || 1),
    maxQty: Math.min(200, parseFloat(String(formData.get("maxQty") ?? "30")) || 30),
    qtyStep: parseFloat(String(formData.get("qtyStep") ?? "0.5")) || 0.5,
    active: formData.get("active") === "on",
    sortOrder: parseInt(String(formData.get("sortOrder") ?? "0")) || 0,
  };
  if (!data.name || data.priceCents <= 0) throw new Error("Name and price are required");

  if (id) {
    const existing = await db.product.findUnique({ where: { id } });
    if (!existing || existing.yardId !== ctx.yard.id) throw new Error("Not found");
    await db.product.update({ where: { id }, data });
  } else {
    await db.product.create({ data: { ...data, yardId: ctx.yard.id } });
  }
  revalidatePath("/app/products");
}

export async function deleteProduct(formData: FormData): Promise<void> {
  const ctx = await ctxOrLogin();
  const id = String(formData.get("id"));
  const existing = await db.product.findUnique({ where: { id } });
  if (!existing || existing.yardId !== ctx.yard.id) throw new Error("Not found");
  // soft delete keeps order history intact
  await db.product.update({ where: { id }, data: { active: false } });
  revalidatePath("/app/products");
}

// ---------- Zones ----------

export async function upsertZone(formData: FormData): Promise<void> {
  const ctx = await ctxOrLogin();
  const id = String(formData.get("id") ?? "");
  const zips = parseZipList(String(formData.get("zipCodes") ?? ""));
  const data = {
    name: String(formData.get("name") ?? "").trim().slice(0, 120),
    zipCodes: JSON.stringify(zips),
    deliveryFeeCents: dollarsToCents(String(formData.get("deliveryFee") ?? "0")),
    minOrderCents: dollarsToCents(String(formData.get("minOrder") ?? "0")),
    active: formData.get("active") === "on",
  };
  if (!data.name || zips.length === 0) throw new Error("Zone name and at least one ZIP required");

  if (id) {
    const existing = await db.zone.findUnique({ where: { id } });
    if (!existing || existing.yardId !== ctx.yard.id) throw new Error("Not found");
    await db.zone.update({ where: { id }, data });
  } else {
    await db.zone.create({ data: { ...data, yardId: ctx.yard.id } });
  }
  revalidatePath("/app/zones");
}

export async function deleteZone(formData: FormData): Promise<void> {
  const ctx = await ctxOrLogin();
  const id = String(formData.get("id"));
  const existing = await db.zone.findUnique({ where: { id } });
  if (!existing || existing.yardId !== ctx.yard.id) throw new Error("Not found");
  await db.zone.update({ where: { id }, data: { active: false } });
  revalidatePath("/app/zones");
}

// ---------- Trucks ----------

export async function upsertTruck(formData: FormData): Promise<void> {
  const ctx = await ctxOrLogin();
  const id = String(formData.get("id") ?? "");
  const data = {
    name: String(formData.get("name") ?? "").trim().slice(0, 120),
    capacityYards: Math.max(1, parseFloat(String(formData.get("capacityYards") ?? "10")) || 10),
    maxTripsPerDay: Math.max(1, parseInt(String(formData.get("maxTripsPerDay") ?? "6")) || 6),
    active: formData.get("active") === "on",
  };
  if (!data.name) throw new Error("Truck name required");

  if (id) {
    const existing = await db.truck.findUnique({ where: { id } });
    if (!existing || existing.yardId !== ctx.yard.id) throw new Error("Not found");
    await db.truck.update({ where: { id }, data });
  } else {
    await db.truck.create({ data: { ...data, yardId: ctx.yard.id } });
  }
  revalidatePath("/app/trucks");
}

// ---------- Settings ----------

export async function updateSettings(formData: FormData): Promise<void> {
  const ctx = await ctxOrLogin();
  await db.yard.update({
    where: { id: ctx.yard.id },
    data: {
      name: String(formData.get("name") ?? ctx.yard.name).trim().slice(0, 160),
      phone: String(formData.get("phone") ?? "").trim().slice(0, 40),
      email: String(formData.get("email") ?? "").trim().slice(0, 200),
      addressLine: String(formData.get("addressLine") ?? "").trim().slice(0, 240),
      city: String(formData.get("city") ?? "").trim().slice(0, 120),
      state: String(formData.get("state") ?? "").trim().slice(0, 40),
      zip: String(formData.get("zip") ?? "").trim().slice(0, 10),
      aboutText: String(formData.get("aboutText") ?? "").trim().slice(0, 1000),
      minLeadDays: Math.max(0, parseInt(String(formData.get("minLeadDays") ?? "1")) || 0),
      maxAdvanceDays: Math.min(90, Math.max(3, parseInt(String(formData.get("maxAdvanceDays") ?? "30")) || 30)),
      orderCutoffHour: Math.min(23, Math.max(0, parseInt(String(formData.get("orderCutoffHour") ?? "15")) || 15)),
      acceptOnlineOrders: formData.get("acceptOnlineOrders") === "on",
      paymentOnDelivery: formData.get("paymentOnDelivery") === "on",
    },
  });
  revalidatePath("/app", "layout");
}
