import { redirect } from "next/navigation";
import { requireYardUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCents, unitLabel } from "@/lib/money";
import PhoneOrderForm from "@/components/PhoneOrderForm";

export const metadata = { title: "New phone order" };

export default async function NewOrderPage() {
  const ctx = await requireYardUser();
  const products = await db.product.findMany({
    where: { yardId: ctx.yard.id, active: true },
    orderBy: { sortOrder: "asc" },
  });
  return (
    <div style={{ maxWidth: 720 }}>
      <h1>New phone order</h1>
      <p className="muted">
        Take an order over the counter or phone. Delivery fee is applied automatically from the
        customer&apos;s ZIP zone.
      </p>
      <PhoneOrderForm
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          unit: unitLabel(p.unit),
          price: formatCents(p.priceCents),
          step: p.qtyStep,
        }))}
      />
    </div>
  );
}
