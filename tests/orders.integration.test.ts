import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { placeOrder, OrderError } from "@/lib/orders";

const FUTURE_DATE = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);

let yardId: string;
let productId: string;

beforeAll(async () => {
  const yard = await db.yard.create({
    data: {
      name: "Test Yard",
      slug: `test-yard-${Date.now()}`,
      email: "owner@test.example.com",
      products: {
        create: [
          {
            name: "Test Mulch",
            unit: "cubic_yard",
            priceCents: 4000,
            minQty: 1,
            maxQty: 30,
            qtyStep: 0.5,
          },
        ],
      },
      zones: {
        create: [
          {
            name: "Local",
            zipCodes: JSON.stringify(["43004"]),
            deliveryFeeCents: 5000,
            minOrderCents: 10000,
          },
        ],
      },
      trucks: { create: [{ name: "T1", capacityYards: 10, maxTripsPerDay: 4 }] },
    },
    include: { products: true },
  });
  yardId = yard.id;
  productId = yard.products[0].id;
});

// The suite runs against a shared (dev-branch) database, so remove everything it created.
// Yard deletion cascades to products/zones/trucks/orders; EmailLog and EventLog have no
// FK relation and are cleaned up explicitly.
afterAll(async () => {
  if (!yardId) return;
  await db.emailLog.deleteMany({ where: { yardId } });
  await db.eventLog.deleteMany({ where: { yardId } });
  await db.yard.delete({ where: { id: yardId } });
});

describe("placeOrder integration", () => {
  it("creates an order with correct totals, items, and emails", async () => {
    const order = await placeOrder({
      yardId,
      channel: "ONLINE",
      customerName: "Integration Tester",
      customerPhone: "555-0000",
      customerEmail: "tester@example.com",
      addressLine: "1 Test St",
      zip: "43004",
      requestedDate: FUTURE_DATE,
      cart: [{ productId, qty: 5 }],
    });
    expect(order.materialCents).toBe(20000);
    expect(order.deliveryCents).toBe(5000);
    expect(order.totalCents).toBe(25000);
    expect(order.items).toHaveLength(1);
    expect(order.number).toBeGreaterThan(1000);
    expect(order.paymentStatus).toBe("PAY_ON_DELIVERY");

    const emails = await db.emailLog.findMany({ where: { yardId } });
    const kinds = emails.map((e) => e.kind).sort();
    expect(kinds).toContain("order_confirmation");
    expect(kinds).toContain("new_order_alert");
  });

  it("increments order numbers per yard", async () => {
    const o1 = await placeOrder({
      yardId,
      channel: "PHONE",
      customerName: "A",
      customerPhone: "1",
      addressLine: "1 St",
      zip: "43004",
      cart: [{ productId, qty: 3 }],
    });
    const o2 = await placeOrder({
      yardId,
      channel: "PHONE",
      customerName: "B",
      customerPhone: "2",
      addressLine: "2 St",
      zip: "43004",
      cart: [{ productId, qty: 3 }],
    });
    expect(o2.number).toBe(o1.number + 1);
  });

  it("rejects online orders outside the delivery area", async () => {
    await expect(
      placeOrder({
        yardId,
        channel: "ONLINE",
        customerName: "X",
        customerPhone: "1",
        addressLine: "1 St",
        zip: "99999",
        cart: [{ productId, qty: 5 }],
      })
    ).rejects.toMatchObject({ code: "out_of_area" });
  });

  it("allows phone orders outside zones (no delivery fee)", async () => {
    const order = await placeOrder({
      yardId,
      channel: "PHONE",
      customerName: "Out of Area",
      customerPhone: "1",
      addressLine: "1 Far St",
      zip: "99999",
      cart: [{ productId, qty: 5 }],
    });
    expect(order.deliveryCents).toBe(0);
    expect(order.zoneId).toBeNull();
  });

  it("rejects online orders below the zone minimum", async () => {
    await expect(
      placeOrder({
        yardId,
        channel: "ONLINE",
        customerName: "X",
        customerPhone: "1",
        addressLine: "1 St",
        zip: "43004",
        cart: [{ productId, qty: 1 }], // $40 < $100 min
      })
    ).rejects.toMatchObject({ code: "below_minimum" });
  });

  it("requires a delivery date for online orders", async () => {
    await expect(
      placeOrder({
        yardId,
        channel: "ONLINE",
        customerName: "X",
        customerPhone: "1",
        addressLine: "1 St",
        zip: "43004",
        cart: [{ productId, qty: 5 }],
      })
    ).rejects.toMatchObject({ code: "bad_date" });
  });

  it("rejects online orders for unavailable dates (past)", async () => {
    await expect(
      placeOrder({
        yardId,
        channel: "ONLINE",
        customerName: "X",
        customerPhone: "1",
        addressLine: "1 St",
        zip: "43004",
        requestedDate: "2020-01-01",
        cart: [{ productId, qty: 5 }],
      })
    ).rejects.toMatchObject({ code: "date_unavailable" });
  });

  it("merges duplicate cart lines instead of stacking them", async () => {
    const order = await placeOrder({
      yardId,
      channel: "PHONE",
      customerName: "Dup",
      customerPhone: "1",
      addressLine: "1 St",
      zip: "43004",
      cart: [
        { productId, qty: 20 },
        { productId, qty: 20 }, // merged to 40 → clamped to maxQty 30
      ],
    });
    expect(order.items).toHaveLength(1);
    expect(order.items[0].qty).toBe(30);
  });

  it("pauses online ordering when the trial has expired", async () => {
    await db.yard.update({
      where: { id: yardId },
      data: { planStatus: "TRIALING", trialEndsAt: new Date(Date.now() - 864e5) },
    });
    await expect(
      placeOrder({
        yardId,
        channel: "ONLINE",
        customerName: "X",
        customerPhone: "1",
        addressLine: "1 St",
        zip: "43004",
        requestedDate: FUTURE_DATE,
        cart: [{ productId, qty: 5 }],
      })
    ).rejects.toMatchObject({ code: "orders_paused" });
    await db.yard.update({
      where: { id: yardId },
      data: { planStatus: "TRIALING", trialEndsAt: null },
    });
  });

  it("rejects empty carts", async () => {
    await expect(
      placeOrder({
        yardId,
        channel: "ONLINE",
        customerName: "X",
        customerPhone: "1",
        addressLine: "1 St",
        zip: "43004",
        cart: [{ productId: "ghost", qty: 5 }],
      })
    ).rejects.toBeInstanceOf(OrderError);
  });

  it("respects paused online ordering but allows phone", async () => {
    await db.yard.update({ where: { id: yardId }, data: { acceptOnlineOrders: false } });
    await expect(
      placeOrder({
        yardId,
        channel: "ONLINE",
        customerName: "X",
        customerPhone: "1",
        addressLine: "1 St",
        zip: "43004",
        cart: [{ productId, qty: 5 }],
      })
    ).rejects.toMatchObject({ code: "orders_paused" });
    const phoneOrder = await placeOrder({
      yardId,
      channel: "PHONE",
      customerName: "X",
      customerPhone: "1",
      addressLine: "1 St",
      zip: "43004",
      cart: [{ productId, qty: 5 }],
    });
    expect(phoneOrder.id).toBeTruthy();
    await db.yard.update({ where: { id: yardId }, data: { acceptOnlineOrders: true } });
  });
});
