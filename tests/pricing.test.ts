import { describe, it, expect } from "vitest";
import { priceCart, clampQty, lineYards } from "@/lib/pricing";
import type { Product } from "@prisma/client";

const product = (over: Partial<Product> = {}): Product =>
  ({
    id: "p1",
    yardId: "y1",
    name: "Mulch",
    category: "mulch",
    description: "",
    unit: "cubic_yard",
    priceCents: 3800,
    minQty: 1,
    maxQty: 30,
    qtyStep: 0.5,
    active: true,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as Product;

const zone = { deliveryFeeCents: 4500, minOrderCents: 7500 };

describe("clampQty", () => {
  it("clamps to min/max and step", () => {
    const p = product();
    expect(clampQty(p, 0.3)).toBe(1); // below min
    expect(clampQty(p, 100)).toBe(30); // above max
    expect(clampQty(p, 2.4)).toBe(2.5); // snapped to step
    expect(clampQty(p, NaN)).toBe(1);
  });
});

describe("lineYards", () => {
  it("counts volume units only", () => {
    expect(lineYards("cubic_yard", 5)).toBe(5);
    expect(lineYards("half_yard", 4)).toBe(2);
    expect(lineYards("face_cord", 2)).toBe(0);
  });
});

describe("priceCart", () => {
  it("prices items, delivery, and totals in integer cents", () => {
    const res = priceCart([product()], zone, [{ productId: "p1", qty: 5 }]);
    expect(res.materialCents).toBe(19000);
    expect(res.deliveryCents).toBe(4500);
    expect(res.totalCents).toBe(23500);
    expect(res.totalYards).toBe(5);
    expect(res.meetsMinOrder).toBe(true);
  });
  it("flags below-minimum orders", () => {
    const res = priceCart([product()], zone, [{ productId: "p1", qty: 1 }]);
    expect(res.materialCents).toBe(3800);
    expect(res.meetsMinOrder).toBe(false);
  });
  it("skips inactive and unknown products", () => {
    const res = priceCart([product({ active: false })], zone, [
      { productId: "p1", qty: 5 },
      { productId: "ghost", qty: 5 },
    ]);
    expect(res.lines).toHaveLength(0);
    expect(res.materialCents).toBe(0);
  });
  it("avoids float artifacts on fractional quantities", () => {
    const res = priceCart([product({ priceCents: 3333 })], zone, [{ productId: "p1", qty: 2.5 }]);
    expect(res.materialCents).toBe(Math.round(2.5 * 3333));
    expect(Number.isInteger(res.materialCents)).toBe(true);
  });
  it("handles null zone (phone orders outside zones)", () => {
    const res = priceCart([product()], null, [{ productId: "p1", qty: 5 }]);
    expect(res.deliveryCents).toBe(0);
    expect(res.meetsMinOrder).toBe(true);
  });
});
