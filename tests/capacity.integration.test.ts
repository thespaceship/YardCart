import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { placeOrder } from "@/lib/orders";

/**
 * Per-method capacity, end to end: filling the dump-truck pool for a day must not close that
 * day for flatbed orders. Under the old single-yards pool it did.
 */

const DATE = new Date(Date.now() + 4 * 864e5).toISOString().slice(0, 10);

let yardId: string;
let dumpId: string;
let flatbedId: string;
let mulchId: string;
let paversId: string;

beforeAll(async () => {
  const yard = await db.yard.create({
    data: {
      name: "Capacity Test Yard",
      slug: `capacity-test-${Date.now()}`,
      phone: "555-0111",
      minLeadDays: 1,
      maxAdvanceDays: 30,
      orderCutoffHour: 23, // keep the cutoff out of the way regardless of wall-clock time
    },
  });
  yardId = yard.id;

  const dump = await db.deliveryMethod.create({
    data: { yardId, name: "Dump truck", maxYards: 18, maxWeightLbs: 20000, sortOrder: 0 },
  });
  const flatbed = await db.deliveryMethod.create({
    data: { yardId, name: "Flatbed", maxPallets: 6, sortOrder: 10 },
  });
  dumpId = dump.id;
  flatbedId = flatbed.id;

  // one trip per day on each method, so a single order fills its pool
  await db.truck.create({
    data: { yardId, name: "Dump 1", maxTripsPerDay: 1, deliveryMethodId: dumpId },
  });
  await db.truck.create({
    data: { yardId, name: "Flat 1", maxTripsPerDay: 1, deliveryMethodId: flatbedId },
  });

  await db.zone.create({
    data: {
      yardId, name: "Local", zipCodes: JSON.stringify(["43004"]),
      deliveryFeeCents: 5000, minOrderCents: 0,
    },
  });

  const mulch = await db.product.create({
    data: {
      yardId, name: "Mulch", category: "mulch", unit: "cubic_yard",
      priceCents: 3800, weightLbsPerUnit: 800,
      methods: { create: [{ methodId: dumpId }] },
    },
  });
  const pavers = await db.product.create({
    data: {
      yardId, name: "Pavers", category: "other", unit: "bag",
      priceCents: 45000, palletsPerUnit: 1, qtyStep: 1,
      methods: { create: [{ methodId: flatbedId }] },
    },
  });
  mulchId = mulch.id;
  paversId = pavers.id;
});

afterAll(async () => {
  if (!yardId) return;
  await db.emailLog.deleteMany({ where: { yardId } });
  await db.eventLog.deleteMany({ where: { yardId } });
  await db.yard.delete({ where: { id: yardId } });
});

const place = (productId: string, qty: number) =>
  placeOrder({
    yardId,
    channel: "ONLINE",
    customerName: "Capacity Tester",
    customerPhone: "555-0000",
    addressLine: "1 Test St",
    zip: "43004",
    requestedDate: DATE,
    cart: [{ productId, qty }],
  });

describe("per-method capacity", () => {
  it("fills the dump pool without closing the day for the flatbed", async () => {
    const first = await place(mulchId, 5);
    expect(first.deliveryMethodId).toBe(dumpId);
    expect(first.tripCount).toBe(1);

    // dump truck is now booked out for that date
    await expect(place(mulchId, 5)).rejects.toMatchObject({ code: "date_unavailable" });

    // ...but the flatbed still has its trip, which the old shared pool would have consumed
    const onFlatbed = await place(paversId, 2);
    expect(onFlatbed.deliveryMethodId).toBe(flatbedId);
  });

  it("rejects a multi-trip order that cannot fit the remaining trips", async () => {
    // the flatbed's single daily trip is already taken by the test above
    await expect(place(paversId, 7)).rejects.toMatchObject({ code: "date_unavailable" });
  });
});
