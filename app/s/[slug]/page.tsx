import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { trackEvent } from "@/lib/observability";
import Storefront from "@/components/Storefront";

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const yard = await db.yard.findUnique({ where: { slug }, select: { name: true, city: true, state: true } });
  if (!yard) return { title: "Not found" };
  return {
    title: `${yard.name} — Bulk delivery, order online`,
    description: `Order bulk mulch, topsoil, and more from ${yard.name}${yard.city ? ` in ${yard.city}, ${yard.state}` : ""}. Instant delivery pricing by ZIP code.`,
  };
}

export default async function StorefrontPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const yard = await db.yard.findUnique({
    where: { slug },
    include: {
      products: { where: { active: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!yard) notFound();
  await trackEvent("storefront_view", { yardId: yard.id });

  const products = yard.products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    description: p.description,
    unit: p.unit,
    priceCents: p.priceCents,
    minQty: p.minQty,
    maxQty: p.maxQty,
    qtyStep: p.qtyStep,
  }));

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <header style={{ background: "var(--brand)", color: "#fff", padding: "28px 0" }}>
        <div className="container">
          <h1 style={{ margin: 0 }}>{yard.name}</h1>
          <p style={{ margin: "6px 0 0", opacity: 0.9 }}>
            {yard.addressLine && `${yard.addressLine}, `}
            {yard.city && `${yard.city}, ${yard.state} `}
            {yard.phone && (
              <>
                · <a style={{ color: "#fff", textDecoration: "underline" }} href={`tel:${yard.phone}`}>{yard.phone}</a>
              </>
            )}
          </p>
        </div>
      </header>
      <main className="container" style={{ padding: "28px 20px 60px", maxWidth: 860 }}>
        {yard.aboutText && <p className="muted" style={{ maxWidth: 640 }}>{yard.aboutText}</p>}
        {!yard.acceptOnlineOrders ? (
          <div className="alert info">
            Online ordering is paused right now — please call {yard.phone || "the yard"} to place an
            order.
          </div>
        ) : (
          <Storefront slug={yard.slug} yardName={yard.name} yardPhone={yard.phone} products={products} />
        )}
        <footer className="mfooter" style={{ marginTop: 48 }}>
          Online ordering powered by <Link href="/">YardCart</Link>
        </footer>
      </main>
    </div>
  );
}
