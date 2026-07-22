import { describe, it, expect } from "vitest";
import {
  selectDelivery,
  selectionMessage,
  rateFor,
  type MethodConfig,
  type AddOnConfig,
  type DeliveryLine,
  type RateTable,
} from "@/lib/delivery";
import type { LoadFactors } from "@/lib/load";

/**
 * Modeled on a real yard's published table:
 *
 *   miles    dump    flat bed
 *   0-3      $60     $210 (+75 forklift)
 *   3-6      $70     $220 (+75 forklift)
 *   12-15    $100    $275 (+75 forklift)
 *
 * plus "Full Semi Dump 20-22 tons — call for quote".
 */
const DUMP: MethodConfig = {
  id: "dump", name: "Medium dump truck", description: "10 ton / 18 yd",
  maxYards: 18, maxWeightLbs: 20000, maxPallets: 0,
  allowMultipleTrips: true, quoteOnly: false, sortOrder: 0,
};
const FLATBED: MethodConfig = {
  id: "flat", name: "Medium flatbed", description: "6 pallets",
  maxYards: 0, maxWeightLbs: 0, maxPallets: 6,
  allowMultipleTrips: true, quoteOnly: false, sortOrder: 10,
};
const SEMI: MethodConfig = {
  id: "semi", name: "Full semi dump", description: "20-22 tons",
  maxYards: 0, maxWeightLbs: 44000, maxPallets: 0,
  allowMultipleTrips: false, quoteOnly: true, sortOrder: 20,
};

const FORKLIFT: AddOnConfig = { id: "fork", name: "Forklift", feeCents: 7500, perTrip: true };

// zone 0-3 miles
const NEAR: RateTable = { fallbackCents: 6000, byMethodId: { dump: 6000, flat: 21000, semi: 0 } };
// zone 12-15 miles — where a flat +$150 surcharge would have gotten it wrong
const FAR: RateTable = { fallbackCents: 10000, byMethodId: { dump: 10000, flat: 27500, semi: 0 } };

const mulchF: LoadFactors = { unit: "cubic_yard", yardsPerUnit: null, weightLbsPerUnit: 800, palletsPerUnit: 0 };
const gravelF: LoadFactors = { unit: "cubic_yard", yardsPerUnit: null, weightLbsPerUnit: 2800, palletsPerUnit: 0 };
const paverF: LoadFactors = { unit: "bag", yardsPerUnit: null, weightLbsPerUnit: 3000, palletsPerUnit: 1 };

const mulch = (qty: number): DeliveryLine => ({
  productId: "p-mulch", qty, factors: mulchF, allowedMethodIds: ["dump", "semi"], requiredAddOnIds: [],
});
const gravel = (qty: number): DeliveryLine => ({
  productId: "p-gravel", qty, factors: gravelF, allowedMethodIds: ["dump", "semi"], requiredAddOnIds: [],
});
const pavers = (qty: number): DeliveryLine => ({
  productId: "p-paver", qty, factors: paverF, allowedMethodIds: ["flat"], requiredAddOnIds: ["fork"],
});
/** A product with no restrictions — the default for a yard that hasn't configured any of this. */
const anything = (qty: number): DeliveryLine => ({
  productId: "p-any", qty, factors: mulchF, allowedMethodIds: [], requiredAddOnIds: [],
});

const base = { methods: [DUMP, FLATBED, SEMI], addOns: [FORKLIFT], rates: NEAR };

describe("rateFor", () => {
  it("uses the grid cell when one exists", () => {
    expect(rateFor(NEAR, "flat")).toBe(21000);
  });

  it("falls back to the zone fee for an unpriced method", () => {
    expect(rateFor({ fallbackCents: 4500, byMethodId: {} }, "dump")).toBe(4500);
  });

  it("treats an explicit zero as free, not missing", () => {
    expect(rateFor({ fallbackCents: 4500, byMethodId: { dump: 0 } }, "dump")).toBe(0);
  });
});

describe("selectDelivery — auto-selection", () => {
  it("returns nothing for an empty cart", () => {
    expect(selectDelivery({ ...base, lines: [] }).kind).toBe("none");
  });

  it("routes bulk mulch to the dump truck at the zone's dump rate", () => {
    const sel = selectDelivery({ ...base, lines: [mulch(10)] });
    expect(sel.kind).toBe("priced");
    if (sel.kind !== "priced") return;
    expect(sel.selected.methodId).toBe("dump");
    expect(sel.selected.trips).toBe(1);
    expect(sel.selected.feeCents).toBe(6000);
  });

  it("routes pallets to the flatbed and adds the forklift automatically", () => {
    const sel = selectDelivery({ ...base, lines: [pavers(4)] });
    expect(sel.kind).toBe("priced");
    if (sel.kind !== "priced") return;
    expect(sel.selected.methodId).toBe("flat");
    // $210 flatbed + $75 forklift
    expect(sel.selected.rateCents).toBe(21000);
    expect(sel.selected.addOnCents).toBe(7500);
    expect(sel.selected.feeCents).toBe(28500);
    expect(sel.selected.addOns[0].name).toBe("Forklift");
  });

  it("prices the far zone off its own grid row, not a surcharge", () => {
    // the reference table's 12-15 mi flatbed is +$175 over dump, not the +$150 of nearer rows
    const sel = selectDelivery({ ...base, rates: FAR, lines: [pavers(2)] });
    expect(sel.kind).toBe("priced");
    if (sel.kind !== "priced") return;
    expect(sel.selected.rateCents).toBe(27500);
    expect(sel.selected.feeCents).toBe(27500 + 7500);
  });

  it("multiplies both the rate and a per-trip add-on across trips", () => {
    const sel = selectDelivery({ ...base, lines: [pavers(7)] }); // 7 pallets → 2 flatbed trips
    expect(sel.kind).toBe("priced");
    if (sel.kind !== "priced") return;
    expect(sel.selected.trips).toBe(2);
    expect(sel.selected.rateCents).toBe(21000 * 2);
    expect(sel.selected.addOnCents).toBe(7500 * 2);
  });

  it("charges a once-per-order add-on a single time regardless of trips", () => {
    const oncePerOrder: AddOnConfig = { ...FORKLIFT, perTrip: false };
    const sel = selectDelivery({ ...base, addOns: [oncePerOrder], lines: [pavers(7)] });
    expect(sel.kind).toBe("priced");
    if (sel.kind !== "priced") return;
    expect(sel.selected.trips).toBe(2);
    expect(sel.selected.addOnCents).toBe(7500);
  });

  it("bills a second dump trip for a load over the weight limit", () => {
    const sel = selectDelivery({ ...base, lines: [gravel(8)] }); // 22,400 lb
    expect(sel.kind).toBe("priced");
    if (sel.kind !== "priced") return;
    expect(sel.selected.trips).toBe(2);
    expect(sel.selected.binding).toBe("weight");
    expect(sel.selected.feeCents).toBe(12000);
  });

  it("defaults to the cheapest eligible method", () => {
    // an unrestricted product can ride either truck; dump is cheaper
    const sel = selectDelivery({ ...base, lines: [anything(2)] });
    expect(sel.kind).toBe("priced");
    if (sel.kind !== "priced") return;
    expect(sel.selected.methodId).toBe("dump");
    expect(sel.options.map((o) => o.methodId)).toEqual(["dump", "flat"]);
  });
});

describe("selectDelivery — customer override", () => {
  it("honors a preferred method when it is eligible", () => {
    const sel = selectDelivery({ ...base, lines: [anything(2)], preferredMethodId: "flat" });
    expect(sel.kind).toBe("priced");
    if (sel.kind !== "priced") return;
    expect(sel.selected.methodId).toBe("flat");
    expect(sel.selected.feeCents).toBe(21000);
  });

  it("ignores a preferred method that cannot carry the cart", () => {
    // pallets can't go on the dump truck — a stale or hand-edited choice must not misprice
    const sel = selectDelivery({ ...base, lines: [pavers(2)], preferredMethodId: "dump" });
    expect(sel.kind).toBe("priced");
    if (sel.kind !== "priced") return;
    expect(sel.selected.methodId).toBe("flat");
  });

  it("ignores an unknown method id", () => {
    const sel = selectDelivery({ ...base, lines: [anything(2)], preferredMethodId: "nope" });
    expect(sel.kind).toBe("priced");
    if (sel.kind !== "priced") return;
    expect(sel.selected.methodId).toBe("dump");
  });
});

describe("selectDelivery — escalation states", () => {
  it("falls to quote-only when the load only fits the semi tier", () => {
    // 30 yd of gravel = 84,000 lb: over the medium dump's per-trip cap, and the semi is quote-only.
    // The medium dump allows multiple trips, so restrict this cart to the semi explicitly.
    const semiOnly: DeliveryLine = {
      productId: "p-bulk", qty: 20, factors: gravelF, allowedMethodIds: ["semi"], requiredAddOnIds: [],
    };
    const sel = selectDelivery({ ...base, lines: [semiOnly] });
    expect(sel.kind).toBe("quote_only");
  });

  it("reports split_required for bulk plus pallets in one cart", () => {
    const sel = selectDelivery({ ...base, lines: [mulch(4), pavers(2)] });
    expect(sel.kind).toBe("split_required");
  });

  it("reports no_method when the cart references a method the yard does not offer", () => {
    const orphan: DeliveryLine = {
      productId: "p-x", qty: 1, factors: mulchF, allowedMethodIds: ["retired-crane"], requiredAddOnIds: [],
    };
    const sel = selectDelivery({ ...base, lines: [orphan] });
    expect(sel.kind).toBe("no_method");
  });

  it("reports no_method when the only carrier refuses multiple trips", () => {
    const singleTrip = { ...DUMP, allowMultipleTrips: false };
    const sel = selectDelivery({
      methods: [singleTrip], addOns: [], rates: NEAR, lines: [gravel(30)],
    });
    expect(sel.kind).toBe("no_method");
  });
});

describe("selectDelivery — no methods configured at all", () => {
  const none = { methods: [], addOns: [], rates: { fallbackCents: 4500, byMethodId: {} } };

  it("still prices the order at the zone fee", () => {
    // a yard that never set this up, or retired its last method, must not lose online ordering
    const sel = selectDelivery({ ...none, lines: [anything(5)] });
    expect(sel.kind).toBe("priced");
    if (sel.kind !== "priced") return;
    expect(sel.selected.feeCents).toBe(4500);
    expect(sel.selected.trips).toBe(1);
  });

  it("marks the fallback with an empty method id so callers store a null reference", () => {
    const sel = selectDelivery({ ...none, lines: [anything(5)] });
    if (sel.kind !== "priced") throw new Error("expected priced");
    expect(sel.selected.methodId).toBe("");
  });

  it("never bills extra trips, however large the cart", () => {
    const sel = selectDelivery({ ...none, lines: [anything(200)] });
    if (sel.kind !== "priced") throw new Error("expected priced");
    expect(sel.selected.trips).toBe(1);
    expect(sel.selected.feeCents).toBe(4500);
  });

  it("ignores product method restrictions that name retired methods", () => {
    // gravel is restricted to "dump"/"semi"; with every method retired those ids resolve to
    // nothing, and honoring the allow-list would reject an order the yard can still deliver
    const sel = selectDelivery({ ...none, lines: [gravel(6)] });
    expect(sel.kind).toBe("priced");
    if (sel.kind !== "priced") return;
    expect(sel.selected.feeCents).toBe(4500);
  });
});

describe("selectDelivery — a yard that has configured nothing", () => {
  it("prices any cart on a single unlimited method at the zone's own fee", () => {
    const catchAll: MethodConfig = {
      id: "default", name: "Delivery", description: "",
      maxYards: 0, maxWeightLbs: 0, maxPallets: 0,
      allowMultipleTrips: true, quoteOnly: false, sortOrder: 0,
    };
    const sel = selectDelivery({
      methods: [catchAll], addOns: [], rates: { fallbackCents: 4500, byMethodId: {} },
      lines: [anything(200)],
    });
    expect(sel.kind).toBe("priced");
    if (sel.kind !== "priced") return;
    expect(sel.selected.trips).toBe(1);
    expect(sel.selected.feeCents).toBe(4500);
  });
});

describe("selectionMessage", () => {
  it("explains a quote-only load and names the yard's phone", () => {
    const msg = selectionMessage({ kind: "quote_only", load: { yards: 0, weightLbs: 0, pallets: 0 }, options: [] }, "555-0100");
    expect(msg).toContain("555-0100");
    expect(msg).toContain("larger than we price online");
  });

  it("falls back gracefully when the yard has no phone on file", () => {
    const msg = selectionMessage({ kind: "split_required", load: { yards: 0, weightLbs: 0, pallets: 0 } }, "");
    expect(msg).toContain("call the yard");
  });

  it("says nothing when the cart priced fine", () => {
    expect(selectionMessage({ kind: "none", load: { yards: 0, weightLbs: 0, pallets: 0 } }, "555")).toBeNull();
  });
});
