import { requireYardUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCents, unitLabel } from "@/lib/money";
import { humanizeSlug, groupByCategory, toView } from "@/lib/categories";
import { ensureDefaultCategories } from "@/lib/categories.server";
import {
  upsertProduct,
  deleteProduct,
  upsertCategory,
  deleteCategory,
  moveCategory,
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
type MethodRow = { id: string; name: string };
type AddOnRow = { id: string; name: string; feeCents: number };

// Starting points so the weight field isn't a blank required-guess. Rough lb per cubic yard.
const WEIGHT_HINTS: Record<string, number> = {
  stone: 2800,
  soil: 2200,
  compost: 1000,
  mulch: 800,
};

function ProductForm({
  product,
  categories,
  methods,
  addOns,
}: {
  product?: {
    id: string; name: string; category: string; description: string; unit: string; imageUrl: string;
    priceCents: number; minQty: number; maxQty: number; qtyStep: number; active: boolean; sortOrder: number;
    yardsPerUnit: number | null; weightLbsPerUnit: number; palletsPerUnit: number;
    methods: { methodId: string }[]; addOns: { addOnId: string }[];
  };
  categories: CategoryRow[];
  methods: MethodRow[];
  addOns: AddOnRow[];
}) {
  const selectedMethods = new Set((product?.methods ?? []).map((m) => m.methodId));
  const selectedAddOns = new Set((product?.addOns ?? []).map((a) => a.addOnId));
  // No rows means "any method" — reflect that by pre-checking everything.
  const allMethods = selectedMethods.size === 0;
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

      <label>Photo</label>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        {product?.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }}
          />
        )}
        <div style={{ flex: 1, minWidth: 220 }}>
          <input type="file" name="image" accept="image/jpeg,image/png,image/webp" />
          <p className="muted" style={{ marginTop: 4 }}>
            Shown on your storefront. JPG/PNG/WebP; we resize &amp; compress it automatically.
          </p>
          {product?.imageUrl && (
            <label style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
              <input type="checkbox" name="removeImage" style={{ width: "auto" }} />
              Remove current photo
            </label>
          )}
        </div>
      </div>

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

      <fieldset style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, margin: "16px 0" }}>
        <legend className="muted" style={{ padding: "0 6px" }}>
          Delivery load
        </legend>
        <div className="field-row">
          <div>
            <label>Weight per unit (lbs)</label>
            <input
              name="weightLbsPerUnit"
              inputMode="decimal"
              defaultValue={product?.weightLbsPerUnit ?? ""}
              placeholder={String(WEIGHT_HINTS[product?.category ?? ""] ?? 0)}
            />
          </div>
          <div>
            <label>Pallets per unit</label>
            <input
              name="palletsPerUnit"
              inputMode="decimal"
              defaultValue={product?.palletsPerUnit ?? ""}
              placeholder="0"
            />
          </div>
          <div>
            <label>Cubic yards per unit</label>
            <input
              name="yardsPerUnit"
              inputMode="decimal"
              defaultValue={product?.yardsPerUnit ?? ""}
              placeholder="auto"
            />
          </div>
        </div>
        <p className="muted" style={{ margin: "4px 0 0", maxWidth: 640 }}>
          Used to work out which truck an order needs and how many trips. Leave weight at{" "}
          <strong>0</strong> to exempt this product from weight limits; leave cubic yards blank to
          derive it from the unit.
        </p>

        {methods.length > 0 && (
          <>
            <label style={{ marginTop: 12 }}>Can be delivered by</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
              {methods.map((m) => (
                <label key={m.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    name="methodIds"
                    value={m.id}
                    defaultChecked={allMethods || selectedMethods.has(m.id)}
                    style={{ width: "auto" }}
                  />
                  {m.name}
                </label>
              ))}
            </div>
          </>
        )}

        {addOns.length > 0 && (
          <>
            <label style={{ marginTop: 12 }}>Requires equipment</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
              {addOns.map((a) => (
                <label key={a.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    name="addOnIds"
                    value={a.id}
                    defaultChecked={selectedAddOns.has(a.id)}
                    style={{ width: "auto" }}
                  />
                  {a.name} <span className="muted">({formatCents(a.feeCents)})</span>
                </label>
              ))}
            </div>
          </>
        )}
      </fieldset>

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

// Shared by the header and every row so the columns actually line up. Each row is its own <form>
// with `display: contents`, which lets the form's children sit directly in the parent grid —
// forms can't be table rows, and a flex row can't align to a separate header.
const CATEGORY_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(160px, 2fr) auto 90px 100px auto",
  gap: 8,
  alignItems: "center",
};

/**
 * Header cells. These sit directly inside the same grid as the rows — a separate header grid
 * sizes its columns independently of the rows' and the two drift apart.
 */
function CategoryHeader() {
  const style: React.CSSProperties = {
    fontSize: "0.78rem",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  };
  return (
    <>
      <span className="muted" style={style}>Category</span>
      <span className="muted" style={style}>Sort</span>
      <span className="muted" style={style}>Shown</span>
      <span className="muted" style={style}>Products</span>
      <span />
    </>
  );
}

function CategoryRowForm({
  category,
  count,
  isFirst,
  isLast,
}: {
  category: CategoryRow;
  count: number;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <form action={upsertCategory} style={{ display: "contents" }}>
      <input type="hidden" name="id" value={category.id} />
      <input name="label" required defaultValue={category.label} aria-label={`Name for ${category.label}`} />
      {/* Direction is bound into the action rather than sent as a field: React commandeers a
          submit button's `name` to carry the server-action id, so name="direction" never arrives. */}
      <div style={{ display: "flex", gap: 4 }}>
        <button
          className="btn secondary small"
          formAction={moveCategory.bind(null, "up")}
          disabled={isFirst}
          aria-label={`Move ${category.label} up`}
          title="Move up"
        >
          ↑
        </button>
        <button
          className="btn secondary small"
          formAction={moveCategory.bind(null, "down")}
          disabled={isLast}
          aria-label={`Move ${category.label} down`}
          title="Move down"
        >
          ↓
        </button>
      </div>
      <label style={{ display: "flex", gap: 6, alignItems: "center", whiteSpace: "nowrap", margin: 0 }}>
        <input type="checkbox" name="active" defaultChecked={category.active} style={{ width: "auto" }} />
        Shown
      </label>
      <span className="muted" style={{ whiteSpace: "nowrap" }}>
        {count} product{count === 1 ? "" : "s"}
      </span>
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
  // Self-heal before reading: a yard whose categories never got created (see the migration-ahead-
  // of-deploy case in ensureDefaultCategories) would otherwise land here with an empty picker and
  // a product form that rejects every save.
  await ensureDefaultCategories(ctx.yard.id);

  const [products, categories, methods, addOns] = await Promise.all([
    db.product.findMany({
      where: { yardId: ctx.yard.id },
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }],
      include: { methods: true, addOns: true },
    }),
    db.category.findMany({
      where: { yardId: ctx.yard.id },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
    db.deliveryMethod.findMany({
      where: { yardId: ctx.yard.id, active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    db.deliveryAddOn.findMany({
      where: { yardId: ctx.yard.id, active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, feeCents: true },
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
  // Same grouping the storefront uses, so the admin list mirrors what customers see.
  const productSections = groupByCategory(products, categories.map(toView));

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
            Categories group your products into sections on your storefront, in the order shown
            here. Use the arrows to move them. Add whatever fits your yard — sand, construction
            material, boulders. Renaming a category is safe; products stay put.
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
          <div style={CATEGORY_GRID}>
            <CategoryHeader />
            {categories.map((c, i) => (
              <CategoryRowForm
                key={c.id}
                category={c}
                count={countBySlug.get(c.slug) ?? 0}
                isFirst={i === 0}
                isLast={i === categories.length - 1}
              />
            ))}
          </div>
          <hr style={{ margin: "16px 0", border: 0, borderTop: "1px solid var(--line)" }} />
          <form action={upsertCategory} className="field-row" style={{ alignItems: "flex-end" }}>
            <div style={{ flex: 2 }}>
              <label>New category</label>
              <input name="label" required placeholder="Construction material" />
            </div>
            <div>
              <input type="hidden" name="active" value="on" />
              <button className="btn">Add category</button>
            </div>
          </form>
          <p className="muted" style={{ margin: "8px 0 0" }}>
            New categories go to the bottom of the list — use the arrows to move them.
          </p>
        </div>
      </details>

      {/* Grouped into the same sections customers see, so a long catalog stays navigable and the
          storefront layout is obvious from here. */}
      {productSections.map((section) => (
        <div key={section.slug}>
          <h2 style={{ margin: "18px 0 10px", fontSize: "1.05rem" }}>
            {section.label}{" "}
            <span className="muted" style={{ fontWeight: 400 }}>
              {section.products.length} product{section.products.length === 1 ? "" : "s"}
            </span>
          </h2>
          <div className="stack">
            {section.products.map((p) => (
              <details className="card" key={p.id}>
                <summary style={{ cursor: "pointer", display: "flex", gap: 12, alignItems: "center" }}>
                  {p.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.imageUrl}
                      alt=""
                      style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6, border: "1px solid var(--line)" }}
                    />
                  )}
                  <strong>{p.name}</strong>
                  <span className="muted">
                    {formatCents(p.priceCents)} / {unitLabel(p.unit)}
                  </span>
                  {!p.active && <span className="badge neutral">Hidden</span>}
                </summary>
                <div style={{ marginTop: 12 }}>
                  <ProductForm product={p} categories={categories} methods={methods} addOns={addOns} />
                  {p.active && (
                    <form action={deleteProduct} style={{ marginTop: 8 }}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="btn danger small">Hide product</button>
                    </form>
                  )}
                </div>
              </details>
            ))}
          </div>
        </div>
      ))}
      <div className="card">
        <h3>Add a product</h3>
        <ProductForm categories={categories} methods={methods} addOns={addOns} />
      </div>
    </div>
  );
}
