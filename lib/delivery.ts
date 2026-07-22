import {
  cartLoad,
  tripsFor,
  bindingDimension,
  emptyLoad,
  type LoadDims,
  type LoadFactors,
} from "./load";

/**
 * Picking how an order gets delivered, and what that costs.
 *
 * The customer shouldn't have to know whether their order needs a dump truck or a flatbed — the
 * cart says which. We compute the load, find every method that can legally carry it, price each,
 * and default to the cheapest. The customer can still switch to another *eligible* method (they
 * may want the flatbed for placement reasons), but they can't pick one that can't do the job.
 *
 * Fee = rate(zone, method) x trips + add-ons. Add-ons are equipment a product in the cart
 * requires — a forklift for pallets — and are charged per trip unless flagged otherwise.
 */

export type MethodConfig = {
  id: string;
  name: string;
  description: string;
  maxYards: number;
  maxWeightLbs: number;
  maxPallets: number;
  allowMultipleTrips: boolean;
  quoteOnly: boolean;
  sortOrder: number;
};

export type AddOnConfig = {
  id: string;
  name: string;
  feeCents: number;
  perTrip: boolean;
};

/** A cart line resolved against its product's delivery attributes. */
export type DeliveryLine = {
  productId: string;
  qty: number;
  factors: LoadFactors;
  /** Methods this product may ride on. Empty = any method. */
  allowedMethodIds: string[];
  /** Equipment this product requires. */
  requiredAddOnIds: string[];
};

export type AppliedAddOn = { id: string; name: string; feeCents: number };

export type MethodQuote = {
  methodId: string;
  name: string;
  description: string;
  trips: number;
  binding: "yards" | "weight" | "pallets" | null;
  rateCents: number;
  addOns: AppliedAddOn[];
  addOnCents: number;
  feeCents: number;
  quoteOnly: boolean;
};

export type DeliverySelection =
  | { kind: "none"; load: LoadDims }
  | { kind: "priced"; load: LoadDims; options: MethodQuote[]; selected: MethodQuote }
  | { kind: "quote_only"; load: LoadDims; options: MethodQuote[] }
  | { kind: "split_required"; load: LoadDims }
  | { kind: "no_method"; load: LoadDims };

/**
 * Stand-in used when a yard has no delivery methods configured. Its empty id marks the quote as
 * "no real method" so callers store a null FK rather than a dangling reference.
 */
export const IMPLICIT_METHOD_ID = "";

const IMPLICIT_METHOD: MethodConfig = {
  id: IMPLICIT_METHOD_ID,
  name: "Delivery",
  description: "",
  maxYards: 0,
  maxWeightLbs: 0,
  maxPallets: 0,
  allowMultipleTrips: true,
  quoteOnly: false,
  sortOrder: 0,
};

/** Rate lookup for one zone: methodId → fee, falling back to the zone's own fee. */
export type RateTable = {
  fallbackCents: number;
  byMethodId: Record<string, number>;
};

export function rateFor(rates: RateTable, methodId: string): number {
  const explicit = rates.byMethodId[methodId];
  return explicit === undefined ? rates.fallbackCents : explicit;
}

function loadOf(lines: DeliveryLine[]): LoadDims {
  return cartLoad(lines.map((l) => ({ qty: l.qty, factors: l.factors })));
}

/** A method can carry a cart only if every line is allowed on it. */
function methodCarriesAll(lines: DeliveryLine[], methodId: string): boolean {
  return lines.every(
    (l) => l.allowedMethodIds.length === 0 || l.allowedMethodIds.includes(methodId)
  );
}

function quoteMethod(
  method: MethodConfig,
  lines: DeliveryLine[],
  load: LoadDims,
  rates: RateTable,
  addOnsById: Map<string, AddOnConfig>
): MethodQuote | null {
  const limits = {
    maxYards: method.maxYards,
    maxWeightLbs: method.maxWeightLbs,
    maxPallets: method.maxPallets,
  };
  const trips = tripsFor(load, limits);
  // A quote-only tier is an escalation path, never something we book, so its trip count can't
  // disqualify it — dropping it here would turn "call us for a quote" into "we can't deliver this".
  if (trips > 1 && !method.allowMultipleTrips && !method.quoteOnly) return null;

  const required = new Set<string>();
  for (const l of lines) for (const id of l.requiredAddOnIds) required.add(id);

  const applied: AppliedAddOn[] = [];
  let addOnCents = 0;
  for (const id of required) {
    const addOn = addOnsById.get(id);
    if (!addOn) continue;
    const cents = addOn.perTrip ? addOn.feeCents * trips : addOn.feeCents;
    applied.push({ id: addOn.id, name: addOn.name, feeCents: cents });
    addOnCents += cents;
  }

  const rateCents = rateFor(rates, method.id) * trips;
  return {
    methodId: method.id,
    name: method.name,
    description: method.description,
    trips,
    binding: bindingDimension(load, limits),
    rateCents,
    addOns: applied,
    addOnCents,
    feeCents: rateCents + addOnCents,
    quoteOnly: method.quoteOnly,
  };
}

/**
 * Resolve how a cart gets delivered.
 *
 * `preferredMethodId` is the customer's override; it is honored only if that method is eligible,
 * so a stale or hand-edited choice quietly falls back to the cheapest rather than mispricing.
 */
export function selectDelivery(opts: {
  lines: DeliveryLine[];
  methods: MethodConfig[];
  addOns: AddOnConfig[];
  rates: RateTable;
  preferredMethodId?: string | null;
}): DeliverySelection {
  const { lines: rawLines, addOns, rates, preferredMethodId } = opts;
  if (rawLines.length === 0) return { kind: "none", load: emptyLoad() };

  // A yard that has never configured delivery methods still has to be able to take orders, and
  // one that retires its last method must not silently close its storefront. Fall back to a
  // single unlimited method priced at the zone's own fee — exactly the pre-methods behavior.
  // Per-product method restrictions are dropped along with it: they name methods the yard no
  // longer offers, so honoring them here would reject every cart.
  const usingFallback = opts.methods.length === 0;
  const methods = usingFallback ? [IMPLICIT_METHOD] : opts.methods;
  const lines = usingFallback
    ? rawLines.map((l) => ({ ...l, allowedMethodIds: [] }))
    : rawLines;

  const load = loadOf(lines);
  const addOnsById = new Map(addOns.map((a) => [a.id, a]));

  // Methods that may legally carry every line, in the yard's display order.
  const carrying = methods
    .filter((m) => methodCarriesAll(lines, m.id))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  if (carrying.length === 0) {
    // Nothing can take the whole cart. If individual lines each have a home, it's a cart that
    // needs more than one delivery; otherwise the yard simply can't haul it.
    const everyLineHasAMethod = lines.every((l) =>
      methods.some((m) => l.allowedMethodIds.length === 0 || l.allowedMethodIds.includes(m.id))
    );
    return { kind: everyLineHasAMethod ? "split_required" : "no_method", load };
  }

  const quotes = carrying
    .map((m) => quoteMethod(m, lines, load, rates, addOnsById))
    .filter((q): q is MethodQuote => q !== null);

  if (quotes.length === 0) return { kind: "no_method", load };

  const priceable = quotes.filter((q) => !q.quoteOnly);
  if (priceable.length === 0) return { kind: "quote_only", load, options: quotes };

  const cheapest = [...priceable].sort(
    (a, b) => a.feeCents - b.feeCents || a.trips - b.trips || a.name.localeCompare(b.name)
  )[0];
  const preferred = preferredMethodId
    ? priceable.find((q) => q.methodId === preferredMethodId)
    : undefined;

  return { kind: "priced", load, options: priceable, selected: preferred ?? cheapest };
}

/** A product row with the relations the delivery engine needs. */
export type ProductWithDelivery = {
  id: string;
  unit: string;
  yardsPerUnit: number | null;
  weightLbsPerUnit: number;
  palletsPerUnit: number;
  methods?: { methodId: string }[];
  addOns?: { addOnId: string }[];
};

/** Resolve priced cart lines against their products' delivery attributes. */
export function deliveryLinesFor(
  products: ProductWithDelivery[],
  lines: { productId: string; qty: number }[]
): DeliveryLine[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const out: DeliveryLine[] = [];
  for (const line of lines) {
    const p = byId.get(line.productId);
    if (!p) continue;
    out.push({
      productId: p.id,
      qty: line.qty,
      factors: {
        unit: p.unit,
        yardsPerUnit: p.yardsPerUnit,
        weightLbsPerUnit: p.weightLbsPerUnit,
        palletsPerUnit: p.palletsPerUnit,
      },
      allowedMethodIds: (p.methods ?? []).map((m) => m.methodId),
      requiredAddOnIds: (p.addOns ?? []).map((a) => a.addOnId),
    });
  }
  return out;
}

/** Build a zone's rate lookup from its DeliveryRate rows. */
export function rateTableFor(zone: {
  deliveryFeeCents: number;
  rates?: { methodId: string; feeCents: number }[];
}): RateTable {
  const byMethodId: Record<string, number> = {};
  for (const r of zone.rates ?? []) byMethodId[r.methodId] = r.feeCents;
  return { fallbackCents: zone.deliveryFeeCents, byMethodId };
}

/** Human-readable reason a cart couldn't be priced, for the storefront and the order form. */
export function selectionMessage(sel: DeliverySelection, yardPhone: string): string | null {
  const call = yardPhone ? ` Please call ${yardPhone}.` : " Please call the yard.";
  switch (sel.kind) {
    case "quote_only":
      return `This load is larger than we price online — we'll quote it for you.${call}`;
    case "split_required":
      return `This order needs more than one delivery, which we can't book online yet.${call}`;
    case "no_method":
      return `We can't deliver this combination online.${call}`;
    default:
      return null;
  }
}
