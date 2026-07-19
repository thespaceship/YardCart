import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { matchZone, isValidZip } from "@/lib/zones";
import { priceCart } from "@/lib/pricing";
import { computeDayLoads, availableDates, horizonKeys } from "@/lib/capacity";
import { localNow } from "@/lib/tz";
import { yardActive } from "@/lib/billing";
import { logError } from "@/lib/observability";

const bodySchema = z.object({
  zip: z.string(),
  cart: z.array(z.object({ productId: z.string(), qty: z.number() })).max(50),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    const { zip, cart } = parsed.data;

    const yard = await db.yard.findUnique({
      where: { slug },
      include: {
        zones: { where: { active: true } },
        products: { where: { active: true } },
        trucks: { where: { active: true } },
      },
    });
    if (!yard) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (!yard.acceptOnlineOrders || !yardActive(yard)) {
      return NextResponse.json(
        { error: "orders_paused", message: "Online ordering is unavailable right now — please call the yard." },
        { status: 422 }
      );
    }

    if (!isValidZip(zip)) {
      return NextResponse.json({ error: "invalid_zip", message: "Enter a 5-digit ZIP code." }, { status: 422 });
    }
    const zone = matchZone(yard.zones, zip);
    if (!zone) {
      return NextResponse.json(
        { error: "out_of_area", message: "Sorry — that ZIP is outside our delivery area. Give us a call and we may still be able to help." },
        { status: 422 }
      );
    }

    const priced = priceCart(yard.products, zone, cart);

    // availability window (yard-local calendar)
    const now = localNow(yard.timezone);
    const horizon = horizonKeys(now, yard.maxAdvanceDays + 1);
    const openOrders = await db.order.findMany({
      where: { yardId: yard.id, status: { in: ["NEW", "SCHEDULED", "OUT_FOR_DELIVERY"] } },
      include: { items: { select: { unitSnap: true, qty: true } } },
    });
    const loads = computeDayLoads(openOrders, yard.trucks, horizon);
    const dates = availableDates({
      now,
      minLeadDays: yard.minLeadDays,
      maxAdvanceDays: yard.maxAdvanceDays,
      orderCutoffHour: yard.orderCutoffHour,
      neededYards: priced.totalYards,
      dayLoads: loads,
    });

    return NextResponse.json({
      zone: { name: zone.name, deliveryFeeCents: zone.deliveryFeeCents, minOrderCents: zone.minOrderCents },
      priced,
      dates,
    });
  } catch (e) {
    await logError("api.quote", e instanceof Error ? e.message : String(e), e instanceof Error ? e.stack : undefined);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
