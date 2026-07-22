import { requireYardUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCents, unitLabel } from "@/lib/money";
import { humanizeSlug } from "@/lib/categories";
import {
  upsertProduct,
  deleteProduct,
  upsertCategory,
  deleteCategory,
} from "@/app/actions/catalog";

export const metadata = { title: "Products" };

const UNITS = [
  ["cubic_yard", "Cubic yard"],
  ["half_yard", "Half yard"],
  ["bag", "Bag"],
  ["cord", "Cord"],
  ["face_cord", "Face cord"],
  ["ton", "Ton"],
];

type CategoryRow = { id: string; slug: string; label: string; sortOrder: number; active: boolean };

function ProductForm({
  product,
  categories,
}: {
  product?: {
    id: string; name: string; category: string; description: string; unit: string;
    priceCents: number; minQty: number; maxQty: number; qtyStep: number; active: boolean; sortOrder: number;
  };
  categories: CategoryRow[];
}) {
  // A product filed under a hidden or deleted category keeps that option visible on its own form,
  // so editing an unrelated field can't silently refile it somewhere else.
  const options = categories.filter((c) => c.active || c.slug === product?.category);
  const orphaned = product && !categories.some((c) => c.slug === product.category);
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
          <select name="category" defaultValue={product?.category ?? options[0]?.slug ?? "other"}>
            {orphaned && (
              <option value={product!.category}>{humanizeSlug(product!.category)}</option>
            )}
            {options.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
                {!c.active ? " (hidden)" : ""}
              </option>
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

function CategoryRowForm({ category, count }: { category: CategoryRow; count: number }) {
  return (
    <form action={upsertCategory} className="field-row" style={{ alignItems: "flex-end" }}>
      <input type="hidden" name="id" value={category.id} />
      <div style={{ flex: 2 }}>
        <input name="label" required defaultValue={category.label} aria-label={`Name for ${category.label}`} />
      </div>
      <div style={{ width: 90 }}>
        <input
          name="sortOrder"
          inputMode="numeric"
          defaultValue={category.sortOrder}
          aria-label={`Sort order for ${category.label}`}
        />
      </div>
      <div>
        <label style={{ display: "flex", gap: 6, alignItems: "center", whiteSpace: "nowrap" }}>
          <input type="checkbox" name="active" defaultChecked={category.active} style={{ width: "auto" }} />
          Shown
        </label>
      </div>
      <div>
        <span className="muted" style={{ whiteSpace: "nowrap" }}>
          {count} product{count === 1 ? "" : "s"}
        </span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button className="btn secondary small">Save</button>
        {category.active && (
          // formAction lets one row post to either action — forms can't nest, and a row-level
          // hide reads far better than a separate stack of danger buttons.
          <button className="btn danger small" formAction={deleteCategory}>
            Hide
          </button>
        )}
      </div>
    </form>
  );
}

export default async function ProductsPage() {
  const ctx = await requireYardUser();
  const [products, categories] = await Promise.all([
    db.product.findMany({
      where: { yardId: ctx.yard.id },
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }],
    }),
    db.category.findMany({
      where: { yardId: ctx.yard.id },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
  ]);

  const countBySlug = new Map<string, number>();
  for (const p of products) {
    if (!p.active) continue;
    countBySlug.set(p.category, (countBySlug.get(p.category) ?? 0) + 1);
  }
  const hiddenWithProducts = categories.filter(
    (c) => !c.active && (countBySlug.get(c.slug) ?? 0) > 0
  );

  return (
    <div className="stack">
      <h1>Products</h1>

      <details className="card">
        <summary style={{ cursor: "pointer" }}>
          <strong>Categories</strong>{" "}
          <span className="muted">
            {categories.filter((c) => c.active).length} shown on your storefront
          </span>
        </summary>
        <div style={{ marginTop: 12 }}>
          <p className="muted" style={{ maxWidth: 640 }}>
            Categories group your products into sections on your storefront, lowest sort order
            first. Add whatever fits your yard — sand, construction material, boulders. Renaming a
            category is safe; products stay put.
          </p>
          {hiddenWithProducts.length > 0 && (
            <div className="alert info">
              {hiddenWithProducts.map((c) => c.label).join(", ")}{" "}
              {hiddenWithProducts.length === 1 ? "is" : "are"} hidden but still{" "}
              {hiddenWithProducts.length === 1 ? "has" : "have"} active products. Those products
              still show on your storefront under their own heading — hide the products themselves
              if you want them off the page.
            </div>
          )}
          {categories.map((c) => (
            <CategoryRowForm key={c.id} category={c} count={countBySlug.get(c.slug) ?? 0} />
          ))}
          <hr style={{ margin: "16px 0", border: 0, borderTop: "1px solid var(--line)" }} />
          <form action={upsertCategory} className="field-row" style={{ alignItems: "flex-end" }}>
            <div style={{ flex: 2 }}>
              <label>New category</label>
              <input name="label" required placeholder="Construction material" />
            </div>
            <div style={{ width: 90 }}>
              <label>Sort</label>
              <input name="sortOrder" inputMode="numeric" defaultValue={(categories.length + 1) * 10} />
            </div>
            <div>
              <input type="hidden" name="active" value="on" />
              <button className="btn">Add category</button>
            </div>
          </form>
        </div>
      </details>

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
            <ProductForm product={p} categories={categories} />
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
        <ProductForm categories={categories} />
      </div>
    </div>
  );
}
