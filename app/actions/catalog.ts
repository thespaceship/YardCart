"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireYardUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dollarsToCents } from "@/lib/money";
import { parseZipList } from "@/lib/zones";
import { categorySlug, moveInList, sortOrdersFor } from "@/lib/categories";
import { sendEmail, emailShell, escapeHtml } from "@/lib/mailer";
import { rateLimit } from "@/lib/ratelimit";
import { assertPlan } from "@/lib/entitlements";

async function ctxOrLogin() {
  const ctx = await requireYardUser();
  return ctx;
}

// ---------- Categories ----------

/** First free slug for `label` within the yard: "sand", then "sand-2", "sand-3", … */
async function uniqueCategorySlug(yardId: string, label: string): Promise<string> {
  const base = categorySlug(label) || "category";
  for (let i = 0; ; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const taken = await db.category.findUnique({
      where: { yardId_slug: { yardId, slug: candidate } },
    });
    if (!taken) return candidate;
  }
}

export async function upsertCategory(formData: FormData): Promise<void> {
  const ctx = await ctxOrLogin();
  const id = String(formData.get("id") ?? "");
  const label = String(formData.get("label") ?? "").trim().slice(0, 60);
  if (!label) throw new Error("Category name is required");
  const sortOrder = parseInt(String(formData.get("sortOrder") ?? "0")) || 0;
  const active = formData.get("active") === "on";

  if (id) {
    const existing = await db.category.findUnique({ where: { id } });
    if (!existing || existing.yardId !== ctx.yard.id) throw new Error("Not found");
    // slug is deliberately not editable — Product.category stores it
    await db.category.update({ where: { id }, data: { label, sortOrder, active } });
  } else {
    await db.category.create({
      data: {
        yardId: ctx.yard.id,
        slug: await uniqueCategorySlug(ctx.yard.id, label),
        label,
        sortOrder,
        active,
      },
    });
  }
  revalidatePath("/app/products");
}

/**
 * Nudge a category one position up or down the storefront.
 *
 * Renumbers the whole list rather than swapping the two sort orders: swapping is a no-op when
 * the pair happens to share a value, and renumbering restores the even spacing at the same time.
 *
 * `direction` is a bound argument rather than a form field: React uses a submit button's own
 * `name` attribute to carry the server-action id, so `name="direction"` on the button is
 * overwritten and never arrives.
 */
export async function moveCategory(
  rawDirection: string,
  formData: FormData
): Promise<void> {
  const ctx = await ctxOrLogin();
  const id = String(formData.get("id"));
  const direction = rawDirection === "up" ? "up" : "down";

  const categories = await db.category.findMany({
    where: { yardId: ctx.yard.id },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: { id: true },
  });
  const index = categories.findIndex((c) => c.id === id);
  if (index === -1) throw new Error("Not found");

  const reordered = moveInList(categories, index, direction);
  if (reordered === categories) return; // already at that end

  const orders = sortOrdersFor(reordered.length);
  await db.$transaction(
    reordered.map((c, i) =>
      db.category.update({ where: { id: c.id }, data: { sortOrder: orders[i] } })
    )
  );
  revalidatePath("/app/products");
}

export async function deleteCategory(formData: FormData): Promise<void> {
  const ctx = await ctxOrLogin();
  const id = String(formData.get("id"));
  const existing = await db.category.findUnique({ where: { id } });
  if (!existing || existing.yardId !== ctx.yard.id) throw new Error("Not found");
  // Soft delete, matching products/zones. Products keep their slug and still get a storefront
  // section (see groupByCategory) rather than vanishing without the owner noticing.
  await db.category.update({ where: { id }, data: { active: false } });
  revalidatePath("/app/products");
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
    // Delivery load. Blank yardsPerUnit means "derive from the unit" — see lib/load.ts.
    yardsPerUnit:
      String(formData.get("yardsPerUnit") ?? "").trim() === ""
        ? null
        : floatField(formData, "yardsPerUnit"),
    weightLbsPerUnit: floatField(formData, "weightLbsPerUnit"),
    palletsPerUnit: floatField(formData, "palletsPerUnit"),
  };
  if (!data.name || data.priceCents <= 0) throw new Error("Name and price are required");
  // The picker only offers this yard's categories; re-check so a hand-crafted POST can't file a
  // product under a slug that has no section.
  const category = await db.category.findUnique({
    where: { yardId_slug: { yardId: ctx.yard.id, slug: data.category } },
  });
  if (!category) throw new Error("Unknown category");

  // Restrict the checkbox sets to this yard's own rows before writing any join records.
  const [ownMethods, ownAddOns] = await Promise.all([
    db.deliveryMethod.findMany({ where: { yardId: ctx.yard.id }, select: { id: true } }),
    db.deliveryAddOn.findMany({ where: { yardId: ctx.yard.id }, select: { id: true } }),
  ]);
  const ownMethodIds = new Set(ownMethods.map((m) => m.id));
  const ownAddOnIds = new Set(ownAddOns.map((a) => a.id));
  const methodIds = formData
    .getAll("methodIds")
    .map(String)
    .filter((mid) => ownMethodIds.has(mid));
  const addOnIds = formData
    .getAll("addOnIds")
    .map(String)
    .filter((aid) => ownAddOnIds.has(aid));
  // "All methods" is the empty set — selecting every method means the same thing, so store it
  // as empty and the product keeps working when the yard adds another method later.
  const methodLinks = methodIds.length === ownMethods.length ? [] : methodIds;

  let productId = id;
  if (id) {
    const existing = await db.product.findUnique({ where: { id } });
    if (!existing || existing.yardId !== ctx.yard.id) throw new Error("Not found");
    await db.product.update({ where: { id }, data });
  } else {
    const created = await db.product.create({ data: { ...data, yardId: ctx.yard.id } });
    productId = created.id;
  }

  await db.$transaction([
    db.productMethod.deleteMany({ where: { productId } }),
    db.productAddOn.deleteMany({ where: { productId } }),
    ...methodLinks.map((methodId) => db.productMethod.create({ data: { productId, methodId } })),
    ...addOnIds.map((addOnId) => db.productAddOn.create({ data: { productId, addOnId } })),
  ]);
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
  assertPlan(ctx.yard, "PRO"); // fleet/truck management is a Pro feature
  const id = String(formData.get("id") ?? "");
  const methodId = String(formData.get("deliveryMethodId") ?? "");
  if (methodId) {
    const method = await db.deliveryMethod.findUnique({ where: { id: methodId } });
    if (!method || method.yardId !== ctx.yard.id) throw new Error("Unknown delivery method");
  }
  const data = {
    name: String(formData.get("name") ?? "").trim().slice(0, 120),
    capacityYards: Math.max(1, parseFloat(String(formData.get("capacityYards") ?? "10")) || 10),
    maxTripsPerDay: Math.max(1, parseInt(String(formData.get("maxTripsPerDay") ?? "6")) || 6),
    deliveryMethodId: methodId || null,
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

// ---------- Delivery methods ----------
//
// Deliberately not plan-gated: a Starter yard still has to be able to charge for a flatbed.
// Truck assignment and dispatch capacity stay Pro (see upsertTruck).

function floatField(formData: FormData, name: string, fallback = 0): number {
  const raw = String(formData.get(name) ?? "").trim();
  if (raw === "") return fallback;
  const n = parseFloat(raw.replace(/,/g, ""));
  return isFinite(n) && n >= 0 ? n : fallback;
}

export async function upsertDeliveryMethod(formData: FormData): Promise<void> {
  const ctx = await ctxOrLogin();
  const id = String(formData.get("id") ?? "");
  const data = {
    name: String(formData.get("name") ?? "").trim().slice(0, 120),
    description: String(formData.get("description") ?? "").trim().slice(0, 300),
    maxYards: floatField(formData, "maxYards"),
    maxWeightLbs: floatField(formData, "maxWeightLbs"),
    maxPallets: floatField(formData, "maxPallets"),
    allowMultipleTrips: formData.get("allowMultipleTrips") === "on",
    quoteOnly: formData.get("quoteOnly") === "on",
    sortOrder: parseInt(String(formData.get("sortOrder") ?? "0")) || 0,
    active: formData.get("active") === "on",
  };
  if (!data.name) throw new Error("Delivery method name is required");

  if (id) {
    const existing = await db.deliveryMethod.findUnique({ where: { id } });
    if (!existing || existing.yardId !== ctx.yard.id) throw new Error("Not found");
    await db.deliveryMethod.update({ where: { id }, data });
  } else {
    await db.deliveryMethod.create({ data: { ...data, yardId: ctx.yard.id } });
  }
  revalidatePath("/app/delivery");
}

export async function deleteDeliveryMethod(formData: FormData): Promise<void> {
  const ctx = await ctxOrLogin();
  const id = String(formData.get("id"));
  const existing = await db.deliveryMethod.findUnique({ where: { id } });
  if (!existing || existing.yardId !== ctx.yard.id) throw new Error("Not found");
  // Soft delete: orders reference the method, and their snapshots should keep resolving.
  await db.deliveryMethod.update({ where: { id }, data: { active: false } });
  revalidatePath("/app/delivery");
}

export async function upsertDeliveryAddOn(formData: FormData): Promise<void> {
  const ctx = await ctxOrLogin();
  const id = String(formData.get("id") ?? "");
  const data = {
    name: String(formData.get("name") ?? "").trim().slice(0, 120),
    feeCents: dollarsToCents(String(formData.get("fee") ?? "0")),
    perTrip: formData.get("perTrip") === "on",
    sortOrder: parseInt(String(formData.get("sortOrder") ?? "0")) || 0,
    active: formData.get("active") === "on",
  };
  if (!data.name) throw new Error("Add-on name is required");

  if (id) {
    const existing = await db.deliveryAddOn.findUnique({ where: { id } });
    if (!existing || existing.yardId !== ctx.yard.id) throw new Error("Not found");
    await db.deliveryAddOn.update({ where: { id }, data });
  } else {
    await db.deliveryAddOn.create({ data: { ...data, yardId: ctx.yard.id } });
  }
  revalidatePath("/app/delivery");
}

export async function deleteDeliveryAddOn(formData: FormData): Promise<void> {
  const ctx = await ctxOrLogin();
  const id = String(formData.get("id"));
  const existing = await db.deliveryAddOn.findUnique({ where: { id } });
  if (!existing || existing.yardId !== ctx.yard.id) throw new Error("Not found");
  await db.deliveryAddOn.update({ where: { id }, data: { active: false } });
  revalidatePath("/app/delivery");
}

/**
 * Save the whole zone × method fee grid in one post. Fields arrive as `rate_<zoneId>_<methodId>`;
 * a blank cell deletes its row so that pair falls back to the zone's own delivery fee.
 */
export async function saveDeliveryRates(formData: FormData): Promise<void> {
  const ctx = await ctxOrLogin();
  const [zones, methods] = await Promise.all([
    db.zone.findMany({ where: { yardId: ctx.yard.id }, select: { id: true } }),
    db.deliveryMethod.findMany({ where: { yardId: ctx.yard.id }, select: { id: true } }),
  ]);
  const zoneIds = new Set(zones.map((z) => z.id));
  const methodIds = new Set(methods.map((m) => m.id));

  const setRows: { zoneId: string; methodId: string; feeCents: number }[] = [];
  const clearRows: { zoneId: string; methodId: string }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("rate_")) continue;
    const [, zoneId, methodId] = key.split("_");
    // ignore ids that aren't this yard's — the grid is rendered from its own rows
    if (!zoneIds.has(zoneId) || !methodIds.has(methodId)) continue;
    const raw = String(value).trim();
    if (raw === "") clearRows.push({ zoneId, methodId });
    else setRows.push({ zoneId, methodId, feeCents: dollarsToCents(raw) });
  }

  await db.$transaction([
    ...clearRows.map((r) =>
      db.deliveryRate.deleteMany({ where: { zoneId: r.zoneId, methodId: r.methodId } })
    ),
    ...setRows.map((r) =>
      db.deliveryRate.upsert({
        where: { zoneId_methodId: { zoneId: r.zoneId, methodId: r.methodId } },
        create: r,
        update: { feeCents: r.feeCents },
      })
    ),
  ]);
  revalidatePath("/app/delivery");
  redirect("/app/delivery?saved=1");
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
      deliveryDays: formData
        .getAll("deliveryDays")
        .map((d) => parseInt(String(d)))
        .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6),
    },
  });
  revalidatePath("/app", "layout");
  redirect("/app/settings?saved=1");
}

// ---------- Support ----------

export async function sendSupportMessage(formData: FormData): Promise<void> {
  const ctx = await ctxOrLogin();
  if (!rateLimit(`support:${ctx.yard.id}`, { limit: 5, windowMs: 60 * 60 * 1000 })) {
    throw new Error("Too many support requests. Try again later.");
  }
  const subject = String(formData.get("subject") ?? "").trim().slice(0, 160) || "Support request";
  const message = String(formData.get("message") ?? "").trim().slice(0, 5000);
  if (!message) throw new Error("Please enter a message.");

  await sendEmail({
    yardId: ctx.yard.id,
    to: "support@getyardcart.com",
    kind: "support_request",
    subject: `[Support] ${subject} — ${ctx.yard.name}`,
    html: emailShell(
      "New support request",
      `<p><strong>Yard:</strong> ${escapeHtml(ctx.yard.name)}<br>
       <strong>From:</strong> ${escapeHtml(ctx.user.name)} (${escapeHtml(ctx.user.email)})</p>
       <p style="white-space:pre-wrap">${escapeHtml(message)}</p>`
    ),
  });
  revalidatePath("/app/settings");
  redirect("/app/settings?supportSent=1");
}
