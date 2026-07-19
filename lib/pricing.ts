import type { Product, Zone } from "@prisma/client";

export type CartLine = { productId: string; qty: number };

export type PricedLine = {
  productId: string;
  nameSnap: string;
  unitSnap: string;
  qty: number;
  unitCents: number;
  totalCents: number;
};

export type PricedCart = {
  lines: PricedLine[];
  materialCents: number;
  deliveryCents: number;
  totalCents: number;
  totalYards: number; // volume-equivalent for capacity planning
  meetsMinOrder: boolean;
  minOrderCents: number;
};

/** Volume in "truck yards" a line consumes, for capacity planning. Non-volume units count as 0. */
export function lineYards(unit: string, qty: number): number {
  switch (unit) {
    case "cubic_yard":
      return qty;
    case "half_yard":
      return qty * 0.5;
    default:
      return 0;
  }
}

export function clampQty(product: Pick<Product, "minQty" | "maxQty" | "qtyStep">, qty: number): number {
  if (!isFinite(qty)) return product.minQty;
  const stepped = Math.round(qty / product.qtyStep) * product.qtyStep;
  const clamped = Math.min(product.maxQty, Math.max(product.minQty, stepped));
  // avoid float artifacts like 2.5000000000000004
  return Math.round(clamped * 100) / 100;
}

export function priceCart(
  products: Product[],
  zone: Pick<Zone, "deliveryFeeCents" | "minOrderCents"> | null,
  cart: CartLine[]
): PricedCart {
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines: PricedLine[] = [];
  for (const line of cart) {
    const p = byId.get(line.productId);
    if (!p || !p.active) continue;
    const qty = clampQty(p, line.qty);
    if (qty <= 0) continue;
    const totalCents = Math.round(qty * p.priceCents);
    lines.push({
      productId: p.id,
      nameSnap: p.name,
      unitSnap: p.unit,
      qty,
      unitCents: p.priceCents,
      totalCents,
    });
  }
  const materialCents = lines.reduce((s, l) => s + l.totalCents, 0);
  const deliveryCents = zone ? zone.deliveryFeeCents : 0;
  const minOrderCents = zone ? zone.minOrderCents : 0;
  const totalYards = lines.reduce((s, l) => s + lineYards(l.unitSnap, l.qty), 0);
  return {
    lines,
    materialCents,
    deliveryCents,
    totalCents: materialCents + deliveryCents,
    totalYards: Math.round(totalYards * 100) / 100,
    meetsMinOrder: materialCents >= minOrderCents,
    minOrderCents,
  };
}
