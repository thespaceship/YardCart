import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { placeOrder } from "@/lib/orders";

/**
 * End-to-end delivery pricing against a yard configured like the reference landscape supplier:
 * a medium dump truck and a medium flatbed, priced per distance band, with a forklift add-on
 * that palletized products pull in automatically.
 */

const FUTURE_DATE = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);

let yardId: string;
let dumpId: string;
let flatbedId: string;
let semiId: string;
let forkliftId: string;
let mulchId: string;
let gravelId: string;
let paversId: string;

beforeAll(async () => {
  const yard = await db.yard.create({
    data: {
      name: "Delivery Test Yard",
      slug: `delivery-test-${Date.now()}`,
      email: "owner@delivery.example.com",
      phone: "555-0199",
      trucks: { create: [{ name: "T1", capacityYards: 18, maxTripsPerDay: 8 }] },
    },
  });
  yardId = yard.id;

  const dump = await db.deliveryMethod.create({
    data: { yardId, name: "Medium dump truck", maxYards: 18, maxWeightLbs: 20000, sortOrder: 0 },
  });
  const flatbed = await db.deliveryMethod.create({
    data: { yardId, name: "Medium flatbed", maxPallets: 6, sortOrder: 10 },
  });
  const semi = await db.deliveryMethod.create({
    data: {
      yardId, name: "Full semi dump", maxWeightLbs: 44000,
      allowMultipleTrips: false, quoteOnly: true, sortOrder: 20,
    },
  });
  dumpId = dump.id;
  flatbedId = flatbed.id;
  semiId = semi.id;

  const forklift = await db.deliveryAddOn.create({
    data: { yardId, name: "Forklift", feeCents: 7500, perTrip: true },
  });
  forkliftId = forklift.id;

  // 0-3 miles: dump $60, flatbed $210
  await db.zone.create({
    data: {
      yardId, name: "0-3 miles", zipCodes: JSON.stringify(["43004"]),
      deliveryFeeCents: 6000, minOrderCents: 0,
      rates: {
        create: [
          { methodId: dumpId, feeCents: 6000 },
          { methodId: flatbedId, feeCents: 21000 },
        ],
      },
    },
  });
  // 12-15 miles: dump $100, flatbed $275 — the row where a flat surcharge would misprice
  await db.zone.create({
    data: {
      yardId, name: "12-15 miles", zipCodes: JSON.stringify(["43062"]),
      deliveryFeeCents: 10000, minOrderCents: 0,
      rates: {
        create: [
          { methodId: dumpId, feeCents: 10000 },
          { methodId: flatbedId, feeCents: 27500 },
        ],
      },
    },
  });

  const mulch = await db.product.create({
    data: {
      yardId, name: "Hardwood Mulch", category: "mulch", unit: "cubic_yard",
      priceCents: 3800, weightLbsPerUnit: 800, maxQty: 60,
      methods: { create: [{ methodId: dumpId }, { methodId: semiId }] },
    },
  });
  const gravel = await db.product.create({
    data: {
      yardId, name: "57 Limestone", category: "stone", unit: "cubic_yard",
      priceCents: 4800, weightLbsPerUnit: 2800, maxQty: 60,
      methods: { create: [{ methodId: dumpId }, { methodId: semiId }] },
    },
  });
  const pavers = await db.product.create({
    data: {
      yardId, name: "Paver Pallet", category: "other", unit: "bag",
      priceCents: 45000, palletsPerUnit: 1, qtyStep: 1, maxQty: 20,
      methods: { create: [{ methodId: flatbedId }] },
      addOns: { create: [{ addOnId: forkliftId }] },
    },
  });
  mulchId = mulch.id;
  gravelId = gravel.id;
  paversId = pavers.id;
});

afterAll(async () => {
  if (!yardId) return;
  await db.emailLog.deleteMany({ where: { yardId } });
  await db.eventLog.deleteMany({ where: { yardId } });
  await db.yard.delete({ where: { id: yardId } });
});

const order = (over: Record<string, unknown>) =>
  placeOrder({
    yardId,
    channel: "ONLINE",
    customerName: "Delivery Tester",
    customerPhone: "555-0000",
    addressLine: "1 Test St",
    zip: "43004",
    requestedDate: FUTURE_DATE,
    cart: [],
    ...over,
  } as Parameters<typeof placeOrder>[0]);

describe("placeOrder — delivery method selection", () => {
  it("routes bulk mulch to the dump truck at the near-zone rate", async () => {
    const o = await order({ cart: [{ productId: mulchId, qty: 10 }] });
    expect(o.deliveryMethodId).toBe(dumpId);
    expect(o.deliveryMethodSnap).toBe("Medium dump truck");
    expect(o.tripCount).toBe(1);
    expect(o.deliveryCents).toBe(6000);
  });

  it("prices the far zone off its own grid row", async () => {
    const o = await order({ zip: "43062", cart: [{ productId: mulchId, qty: 10 }] });
    expect(o.deliveryCents).toBe(10000);
  });

  it("bills a second dump trip once gravel crosses the weight limit", async () => {
    // 8 yd x 2,800 lb = 22,400 lb, over the 10-ton cap
    const o = await order({ cart: [{ productId: gravelId, qty: 8 }] });
    expect(o.deliveryMethodId).toBe(dumpId);
    expect(o.tripCount).toBe(2);
    expect(o.deliveryCents).toBe(12000);
  });

  it("keeps 7 yards of gravel to a single trip", async () => {
    const o = await order({ cart: [{ productId: gravelId, qty: 7 }] });
    expect(o.tripCount).toBe(1);
    expect(o.deliveryCents).toBe(6000);
  });

  it("routes pallets to the flatbed and adds the forklift", async () => {
    const o = await order({ cart: [{ productId: paversId, qty: 4 }] });
    expect(o.deliveryMethodId).toBe(flatbedId);
    expect(o.deliveryCents).toBe(21000 + 7500);
    const addOns = JSON.parse(o.deliveryAddOnsSnap) as { name: string; feeCents: number }[];
    expect(addOns).toEqual([{ name: "Forklift", feeCents: 7500 }]);
  });

  it("charges the forklift on each trip of a multi-trip flatbed order", async () => {
    const o = await order({ cart: [{ productId: paversId, qty: 7 }] });
    expect(o.tripCount).toBe(2);
    expect(o.deliveryCents).toBe(21000 * 2 + 7500 * 2);
  });

  it("rejects a cart that needs both a dump truck and a flatbed", async () => {
    await expect(
      order({ cart: [{ productId: mulchId, qty: 4 }, { productId: paversId, qty: 2 }] })
    ).rejects.toMatchObject({ code: "split_required" });
  });

  it("recomputes the fee rather than trusting the client's method choice", async () => {
    // asking for the cheap dump truck on a pallet order must not dodge the flatbed price
    const o = await order({ cart: [{ productId: paversId, qty: 2 }], deliveryMethodId: dumpId });
    expect(o.deliveryMethodId).toBe(flatbedId);
    expect(o.deliveryCents).toBe(21000 + 7500);
  });

  it("honors a customer override between two eligible methods", async () => {
    const unrestricted = await db.product.create({
      data: {
        yardId, name: "Bagged Salt", category: "other", unit: "bag",
        priceCents: 900, qtyStep: 1, maxQty: 40,
      },
    });
    const auto = await order({ cart: [{ productId: unrestricted.id, qty: 2 }] });
    expect(auto.deliveryMethodId).toBe(dumpId); // cheapest by default

    const overridden = await order({
      cart: [{ productId: unrestricted.id, qty: 2 }],
      deliveryMethodId: flatbedId,
    });
    expect(overridden.deliveryMethodId).toBe(flatbedId);
    expect(overridden.deliveryCents).toBe(21000);
  });

  it("escalates a semi-sized load to a quote instead of pricing it", async () => {
    const semiOnly = await db.product.create({
      data: {
        yardId, name: "Bulk Fill (semi)", category: "other", unit: "cubic_yard",
        priceCents: 1800, weightLbsPerUnit: 2800, maxQty: 100,
        methods: { create: [{ methodId: semiId }] },
      },
    });
    await expect(order({ cart: [{ productId: semiOnly.id, qty: 20 }] })).rejects.toMatchObject({
      code: "quote_only",
    });
  });

  it("still records a delivery for a phone order outside every zone", async () => {
    const o = await order({
      channel: "PHONE",
      zip: "99999",
      requestedDate: undefined,
      cart: [{ productId: mulchId, qty: 3 }],
    });
    expect(o.zoneId).toBeNull();
    expect(o.deliveryCents).toBe(0);
    expect(o.tripCount).toBe(1);
  });
});
