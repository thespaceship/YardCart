/**
 * Seeds the SYNTHETIC DEMO environment: "Cedar Ridge Landscape Supply", a fictional
 * yard with products, zones, trucks, and a realistic spread of orders.
 * Demo login: demo@yardcart.test / demo-password-123
 * All customer names/addresses below are synthetic.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const DEMO_ZIPS_NEAR = ["43004", "43230", "43068", "43110"];
const DEMO_ZIPS_FAR = ["43062", "43147", "43046", "43155"];

const CUSTOMERS = [
  { name: "Pat Delgado", phone: "555-0141", email: "pat.delgado@example.com", addr: "214 Birchwood Ln", zip: "43004" },
  { name: "Morgan Fields", phone: "555-0192", email: "morgan.f@example.com", addr: "88 Quarry Ridge Dr", zip: "43230" },
  { name: "Sam Okafor", phone: "555-0117", email: "sam.okafor@example.com", addr: "1520 Meadow Gate Ct", zip: "43068" },
  { name: "Jesse Tran", phone: "555-0175", email: "", addr: "6 Old Mill Rd", zip: "43110" },
  { name: "Riley Baumann", phone: "555-0163", email: "riley.b@example.com", addr: "402 Sycamore St", zip: "43062" },
  { name: "Casey Whitfield", phone: "555-0129", email: "casey.w@example.com", addr: "77 Harvest Moon Way", zip: "43147" },
  { name: "Alex Petrov", phone: "555-0184", email: "", addr: "930 Stonebrook Ave", zip: "43004" },
  { name: "Jordan Lacy", phone: "555-0156", email: "jordan.lacy@example.com", addr: "12 Fox Hollow Rd", zip: "43230" },
];

async function main() {
  const existing = await db.yard.findUnique({ where: { slug: "cedar-ridge-demo" } });
  if (existing) {
    console.log("Demo yard already seeded. Run `npx prisma migrate reset` to reseed.");
    return;
  }

  const yard = await db.yard.create({
    data: {
      name: "Cedar Ridge Landscape Supply",
      slug: "cedar-ridge-demo",
      phone: "(555) 014-2200",
      email: "office@cedarridge.example.com",
      addressLine: "4801 Quarry Rd",
      city: "Columbus",
      state: "OH",
      zip: "43004",
      aboutText:
        "Family-run landscape supply yard serving the east side since 1998. Bulk mulch, screened topsoil, compost, and seasoned firewood — delivered to your driveway.",
      plan: "PRO",
      planStatus: "ACTIVE",
      onboardedAt: new Date(),
    },
  });

  const pw = await bcrypt.hash("demo-password-123", 11);
  await db.user.create({
    data: {
      email: "demo@yardcart.test",
      passwordHash: pw,
      name: "Demo Owner",
      role: "OWNER",
      yardId: yard.id,
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
  const products = [];
  for (const p of productData) {
    products.push(await db.product.create({ data: { ...p, yardId: yard.id } }));
  }

  const zoneNear = await db.zone.create({
    data: {
      yardId: yard.id,
      name: "Local (within ~10 mi)",
      zipCodes: JSON.stringify(DEMO_ZIPS_NEAR),
      deliveryFeeCents: 4500,
      minOrderCents: 7500,
    },
  });
  const zoneFar = await db.zone.create({
    data: {
      yardId: yard.id,
      name: "Extended (10–25 mi)",
      zipCodes: JSON.stringify(DEMO_ZIPS_FAR),
      deliveryFeeCents: 8500,
      minOrderCents: 15000,
    },
  });

  const truck1 = await db.truck.create({
    data: { yardId: yard.id, name: "Truck 1 — F-550 Dump", capacityYards: 5, maxTripsPerDay: 6 },
  });
  const truck2 = await db.truck.create({
    data: { yardId: yard.id, name: "Truck 2 — Tandem Dump", capacityYards: 14, maxTripsPerDay: 4 },
  });

  // Orders across past, today, and upcoming days
  let number = 1001;
  const now = new Date();
  const day = (offset: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    d.setUTCHours(12, 0, 0, 0);
    return d;
  };

  const mk = async (opts: {
    ci: number;
    dayOffset: number;
    status: string;
    items: { pi: number; qty: number }[];
    channel?: string;
    truckId?: string | null;
    slot?: string;
    paid?: boolean;
  }) => {
    const c = CUSTOMERS[opts.ci];
    const zone = DEMO_ZIPS_NEAR.includes(c.zip) ? zoneNear : zoneFar;
    const items = opts.items.map(({ pi, qty }) => {
      const p = products[pi];
      return {
        productId: p.id,
        nameSnap: p.name,
        unitSnap: p.unit,
        qty,
        unitCents: p.priceCents,
        totalCents: Math.round(qty * p.priceCents),
      };
    });
    const materialCents = items.reduce((s, i) => s + i.totalCents, 0);
    const isPast = opts.dayOffset < 0;
    await db.order.create({
      data: {
        yardId: yard.id,
        number: number++,
        channel: opts.channel ?? "ONLINE",
        status: opts.status,
        customerName: c.name,
        customerPhone: c.phone,
        customerEmail: c.email,
        addressLine: c.addr,
        city: "Columbus",
        zip: c.zip,
        zoneId: zone.id,
        placementNotes: opts.ci % 3 === 0 ? "Dump on driveway, left of garage." : "",
        materialCents,
        deliveryCents: zone.deliveryFeeCents,
        totalCents: materialCents + zone.deliveryFeeCents,
        paymentStatus: opts.paid ? "PAID" : "PAY_ON_DELIVERY",
        paymentMethod: opts.paid ? "card" : "",
        requestedDate: day(opts.dayOffset),
        scheduledDate: opts.status === "NEW" ? null : day(opts.dayOffset),
        scheduledSlot: opts.slot ?? "",
        truckId: opts.truckId ?? null,
        deliveredAt: opts.status === "DELIVERED" ? day(opts.dayOffset) : null,
        createdAt: day(Math.min(opts.dayOffset - 1, -1)),
        items: { create: items },
      },
    });
  };

  // Delivered history (last week)
  await mk({ ci: 0, dayOffset: -6, status: "DELIVERED", items: [{ pi: 0, qty: 5 }], truckId: truck1.id, slot: "AM", paid: true });
  await mk({ ci: 1, dayOffset: -5, status: "DELIVERED", items: [{ pi: 3, qty: 8 }], truckId: truck2.id, slot: "AM" });
  await mk({ ci: 2, dayOffset: -4, status: "DELIVERED", items: [{ pi: 1, qty: 4 }, { pi: 5, qty: 2 }], truckId: truck1.id, slot: "PM", paid: true });
  await mk({ ci: 3, dayOffset: -2, status: "DELIVERED", items: [{ pi: 6, qty: 2 }], channel: "PHONE", truckId: truck1.id, slot: "AM" });
  // Today
  await mk({ ci: 4, dayOffset: 0, status: "OUT_FOR_DELIVERY", items: [{ pi: 0, qty: 10 }], truckId: truck2.id, slot: "AM" });
  await mk({ ci: 5, dayOffset: 0, status: "SCHEDULED", items: [{ pi: 4, qty: 6 }], truckId: truck2.id, slot: "PM" });
  // Upcoming
  await mk({ ci: 6, dayOffset: 1, status: "SCHEDULED", items: [{ pi: 2, qty: 3 }], truckId: truck1.id, slot: "AM" });
  await mk({ ci: 7, dayOffset: 2, status: "NEW", items: [{ pi: 0, qty: 6 }, { pi: 3, qty: 2 }] });
  await mk({ ci: 0, dayOffset: 3, status: "NEW", items: [{ pi: 1, qty: 8 }], channel: "PHONE" });

  await db.eventLog.createMany({
    data: [
      { yardId: yard.id, type: "storefront_view", meta: "{}", createdAt: day(-3) },
      { yardId: yard.id, type: "storefront_view", meta: "{}", createdAt: day(-2) },
      { yardId: yard.id, type: "storefront_view", meta: "{}", createdAt: day(-1) },
      { yardId: yard.id, type: "order_placed", meta: "{}", createdAt: day(-2) },
    ],
  });

  console.log("Seeded demo yard:", yard.slug);
  console.log("Demo login: demo@yardcart.test / demo-password-123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
