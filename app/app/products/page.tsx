import { requireYardUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCents, unitLabel } from "@/lib/money";
import { upsertProduct, deleteProduct } from "@/app/actions/catalog";

export const metadata = { title: "Products" };

const UNITS = [
  ["cubic_yard", "Cubic yard"],
  ["half_yard", "Half yard"],
  ["bag", "Bag"],
  ["cord", "Cord"],
  ["face_cord", "Face cord"],
  ["ton", "Ton"],
];
const CATEGORIES = ["mulch", "soil", "compost", "stone", "firewood", "other"];

function ProductForm({ product }: { product?: {
  id: string; name: string; category: string; description: string; unit: string;
  priceCents: number; minQty: number; maxQty: number; qtyStep: number; active: boolean; sortOrder: number;
} }) {
  return (
    <form action={upsertProduct}>
      {product && <input type="hidden" name="id" value={product.id} />}
      <div className="field-row">
        <div style={{ flex: 2 }}>
          <label>Name</label>
          <input name="name" required defaultValue={product?.name} />
        </div>
        <div>
          <label>Category</label>
          <select name="category" defaultValue={product?.category ?? "mulch"}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <label>Description</label>
      <input name="description" defaultValue={product?.description} />
      <div className="field-row">
        <div>
          <label>Unit</label>
          <select name="unit" defaultValue={product?.unit ?? "cubic_yard"}>
            {UNITS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Price per unit ($)</label>
          <input name="price" required inputMode="decimal" defaultValue={product ? (product.priceCents / 100).toFixed(2) : ""} />
        </div>
        <div>
          <label>Min qty</label>
          <input name="minQty" inputMode="decimal" defaultValue={product?.minQty ?? 1} />
        </div>
        <div>
          <label>Max qty</label>
          <input name="maxQty" inputMode="decimal" defaultValue={product?.maxQty ?? 30} />
        </div>
        <div>
          <label>Step</label>
          <input name="qtyStep" inputMode="decimal" defaultValue={product?.qtyStep ?? 0.5} />
        </div>
        <div>
          <label>Sort</label>
          <input name="sortOrder" inputMode="numeric" defaultValue={product?.sortOrder ?? 0} />
        </div>
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" name="active" defaultChecked={product?.active ?? true} style={{ width: "auto" }} />
        Visible on storefront
      </label>
      <div style={{ marginTop: 12 }}>
        <button className="btn">{product ? "Save" : "Add product"}</button>
      </div>
    </form>
  );
}

export default async function ProductsPage() {
  const ctx = await requireYardUser();
  const products = await db.product.findMany({
    where: { yardId: ctx.yard.id },
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }],
  });

  return (
    <div className="stack">
      <h1>Products</h1>
      {products.map((p) => (
        <details className="card" key={p.id}>
          <summary style={{ cursor: "pointer", display: "flex", gap: 12, alignItems: "center" }}>
            <strong>{p.name}</strong>
            <span className="muted">
              {formatCents(p.priceCents)} / {unitLabel(p.unit)}
            </span>
            {!p.active && <span className="badge neutral">Hidden</span>}
          </summary>
          <div style={{ marginTop: 12 }}>
            <ProductForm product={p} />
            {p.active && (
              <form action={deleteProduct} style={{ marginTop: 8 }}>
                <input type="hidden" name="id" value={p.id} />
                <button className="btn danger small">Hide product</button>
              </form>
            )}
          </div>
        </details>
      ))}
      <div className="card">
        <h3>Add a product</h3>
        <ProductForm />
      </div>
    </div>
  );
}
