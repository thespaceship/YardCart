/**
 * Production-safe demo seed: creates ONLY the public demo storefront
 * ("Cedar Ridge Landscape Supply", slug cedar-ridge-demo) — the yard, its products,
 * delivery zones, and trucks.
 *
 * Deliberately different from the full local seed (prisma/seed.ts):
 *  - no login user (nobody can sign in to the demo yard in production)
 *  - no yard email (even if an email path were reached, there is no recipient)
 *  - no fake orders (visitors see a fully open delivery calendar)
 *
 * Checkout against this yard is simulated server-side (see lib/demo.ts and the
 * storefront order route): no order rows are created and no emails are sent.
 *
 * Run once against production:
 *   DATABASE_URL="<neon connection string>" npm run seed:demo
 */
import { PrismaClient } from "@prisma/client";
import { DEMO_YARD_SLUG } from "../lib/demo";

const db = new PrismaClient();

async function main() {
  const existing = await db.yard.findUnique({ where: { slug: DEMO_YARD_SLUG } });
  if (existing) {
    console.log(`Demo yard "${DEMO_YARD_SLUG}" already exists — nothing to do.`);
    return;
  }

  const yard = await db.yard.create({
    data: {
      name: "Cedar Ridge Landscape Supply",
      slug: DEMO_YARD_SLUG,
      phone: "(555) 014-2200",
      email: "", // intentionally empty: the demo yard must never receive real email
      addressLine: "4801 Quarry Rd",
      city: "Columbus",
      state: "OH",
      zip: "43004",
      aboutText:
        "A fictional, family-run landscape supply yard — this storefront is the YardCart live demo. Bulk mulch, screened topsoil, compost, and seasoned firewood, delivered to your driveway.",
      plan: "PRO",
      planStatus: "ACTIVE",
      onboardedAt: new Date(),
    },
  });

  const productData = [
    { name: "Double-Shredded Hardwood Mulch", category: "mulch", unit: "cubic_yard", priceCents: 3800, sortOrder: 1, description: "Aged double-ground hardwood. Our most popular." },
    { name: "Black Dyed Mulch", category: "mulch", unit: "cubic_yard", priceCents: 4200, sortOrder: 2, description: "Holds color all season." },
    { name: "Cedar Mulch", category: "mulch", unit: "cubic_yard", priceCents: 5200, sortOrder: 3, description: "Aromatic cedar." },
    { name: "Screened Topsoil", category: "soil", unit: "cubic_yard", priceCents: 3400, sortOrder: 4, description: "3/8\" screened." },
    { name: "Garden Mix", category: "soil", unit: "cubic_yard", priceCents: 4400, sortOrder: 5, description: "60/40 topsoil-compost blend." },
    { name: "Leaf Compost", category: "compost", unit: "cubic_yard", priceCents: 3600, sortOrder: 6, description: "Fully composted leaf humus." },
    { name: "Seasoned Firewood (Face Cord)", category: "firewood", unit: "face_cord", priceCents: 14500, sortOrder: 7, description: "Mixed hardwood, 16\" splits." },
  ];
  for (const p of productData) {
    await db.product.create({ data: { ...p, yardId: yard.id } });
  }

  await db.zone.create({
    data: {
      yardId: yard.id,
      name: "Local (within ~10 mi)",
      zipCodes: JSON.stringify(["43004", "43230", "43068", "43110"]),
      deliveryFeeCents: 4500,
      minOrderCents: 7500,
    },
  });
  await db.zone.create({
    data: {
      yardId: yard.id,
      name: "Extended (10–25 mi)",
      zipCodes: JSON.stringify(["43062", "43147", "43046", "43155"]),
      deliveryFeeCents: 8500,
      minOrderCents: 15000,
    },
  });

  await db.truck.create({
    data: { yardId: yard.id, name: "Truck 1 — F-550 Dump", capacityYards: 5, maxTripsPerDay: 6 },
  });
  await db.truck.create({
    data: { yardId: yard.id, name: "Truck 2 — Tandem Dump", capacityYards: 14, maxTripsPerDay: 4 },
  });

  console.log(`Seeded production demo storefront: /s/${yard.slug} (no user, no email, no orders)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
