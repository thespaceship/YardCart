import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/lib/db";
import { placeOrder, OrderError } from "@/lib/orders";

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
      requestedDate: "2026-08-01",
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
