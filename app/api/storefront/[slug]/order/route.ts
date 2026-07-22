import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isDemoSlug } from "@/lib/demo";
import { placeOrder, OrderError } from "@/lib/orders";
import { rateLimit } from "@/lib/ratelimit";
import { logError } from "@/lib/observability";

const bodySchema = z.object({
  customerName: z.string().trim().min(1).max(120),
  customerPhone: z.string().trim().min(7).max(40),
  customerEmail: z.string().trim().email().max(200).or(z.literal("")),
  addressLine: z.string().trim().min(3).max(240),
  city: z.string().trim().max(120).optional(),
  zip: z.string().trim().min(5).max(10),
  placementNotes: z.string().max(1000).optional(),
  requestedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cart: z.array(z.object({ productId: z.string(), qty: z.number().positive() })).min(1).max(50),
  deliveryMethodId: z.string().optional(), // preference only; placeOrder re-validates the fee
  website: z.string().optional(), // honeypot
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!rateLimit(`order:${ip}`, { limit: 8, windowMs: 60 * 60 * 1000 })) {
      return NextResponse.json(
        { error: "rate_limited", message: "Too many orders from this connection. Please call the yard instead." },
        { status: 429 }
      );
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "bad_request", message: "Please check the highlighted fields and try again." },
        { status: 400 }
      );
    }
    if (parsed.data.website) {
      // honeypot filled → likely bot; pretend success without creating anything
      return NextResponse.json({ ok: true, orderId: "ok" });
    }
    if (isDemoSlug(slug)) {
      // Demo storefront: checkout is simulated — no order row, no emails. The client
      // shows a "no real order was placed" confirmation when it sees demo: true.
      return NextResponse.json({ ok: true, demo: true });
    }

    const yard = await db.yard.findUnique({ where: { slug }, select: { id: true } });
    if (!yard) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const order = await placeOrder({
      yardId: yard.id,
      channel: "ONLINE",
      customerName: parsed.data.customerName,
      customerPhone: parsed.data.customerPhone,
      customerEmail: parsed.data.customerEmail || undefined,
      addressLine: parsed.data.addressLine,
      city: parsed.data.city,
      zip: parsed.data.zip,
      placementNotes: parsed.data.placementNotes,
      requestedDate: parsed.data.requestedDate,
      cart: parsed.data.cart,
      deliveryMethodId: parsed.data.deliveryMethodId,
    });

    return NextResponse.json({ ok: true, orderId: order.id, number: order.number });
  } catch (e) {
    if (e instanceof OrderError) {
      return NextResponse.json({ error: e.code, message: e.message }, { status: 422 });
    }
    await logError("api.order", e instanceof Error ? e.message : String(e), e instanceof Error ? e.stack : undefined);
    return NextResponse.json(
      { error: "server_error", message: "Something went wrong placing your order. Please call the yard." },
      { status: 500 }
    );
  }
}
