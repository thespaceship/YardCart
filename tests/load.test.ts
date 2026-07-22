import { describe, it, expect } from "vitest";
import {
  cartLoad,
  utilization,
  tripsFor,
  bindingDimension,
  derivedYardsPerUnit,
  yardsPerUnitOf,
  type LoadFactors,
} from "@/lib/load";

// Reference yard: medium dump truck rated "10 ton gravels & 18 yards mulch and soils".
const MEDIUM_DUMP = { maxYards: 18, maxWeightLbs: 20000, maxPallets: 0 };
// Medium flatbed: 6 pallet material limit.
const MEDIUM_FLATBED = { maxYards: 0, maxWeightLbs: 0, maxPallets: 6 };
const UNLIMITED = { maxYards: 0, maxWeightLbs: 0, maxPallets: 0 };

const mulch: LoadFactors = { unit: "cubic_yard", yardsPerUnit: null, weightLbsPerUnit: 800, palletsPerUnit: 0 };
const gravel: LoadFactors = { unit: "cubic_yard", yardsPerUnit: null, weightLbsPerUnit: 2800, palletsPerUnit: 0 };
const pavers: LoadFactors = { unit: "bag", yardsPerUnit: null, weightLbsPerUnit: 3000, palletsPerUnit: 1 };
// A yard selling gravel by the ton, telling us a ton also occupies ~0.7 yd of the bed.
const gravelByTon: LoadFactors = { unit: "ton", yardsPerUnit: 0.7, weightLbsPerUnit: 2000, palletsPerUnit: 0 };

describe("derivedYardsPerUnit", () => {
  it("maps volume units and zeroes everything else", () => {
    expect(derivedYardsPerUnit("cubic_yard")).toBe(1);
    expect(derivedYardsPerUnit("half_yard")).toBe(0.5);
    expect(derivedYardsPerUnit("ton")).toBe(0);
    expect(derivedYardsPerUnit("bag")).toBe(0);
  });

  it("lets a product override the derived value", () => {
    expect(yardsPerUnitOf(gravelByTon)).toBe(0.7);
    expect(yardsPerUnitOf(mulch)).toBe(1);
  });
});

describe("cartLoad", () => {
  it("sums each dimension across lines", () => {
    const load = cartLoad([
      { qty: 4, factors: mulch },
      { qty: 2, factors: gravel },
    ]);
    expect(load.yards).toBe(6);
    expect(load.weightLbs).toBe(4 * 800 + 2 * 2800);
  });

  it("counts pallets only from palletized products", () => {
    const load = cartLoad([
      { qty: 3, factors: pavers },
      { qty: 5, factors: mulch },
    ]);
    expect(load.pallets).toBe(3);
  });

  it("is empty for an empty cart", () => {
    expect(cartLoad([])).toEqual({ yards: 0, weightLbs: 0, pallets: 0 });
  });
});

describe("utilization", () => {
  it("takes the hardest-binding dimension", () => {
    // 7 yd gravel: volume 7/18 = 0.39, weight 19600/20000 = 0.98 → weight binds
    const load = cartLoad([{ qty: 7, factors: gravel }]);
    expect(utilization(load, MEDIUM_DUMP)).toBeCloseTo(0.98, 2);
  });

  it("ignores dimensions with no limit set", () => {
    // the flatbed caps pallets only, so 40 yards of mulch doesn't register
    const load = cartLoad([{ qty: 40, factors: mulch }]);
    expect(utilization(load, MEDIUM_FLATBED)).toBe(0);
  });

  it("is zero when the method is unlimited", () => {
    const load = cartLoad([{ qty: 100, factors: gravel }]);
    expect(utilization(load, UNLIMITED)).toBe(0);
  });
});

describe("tripsFor — the reference yard's stated limits", () => {
  it("fits 7 yards of gravel in one trip (just under 10 tons)", () => {
    expect(tripsFor(cartLoad([{ qty: 7, factors: gravel }]), MEDIUM_DUMP)).toBe(1);
  });

  it("needs two trips for 8 yards of gravel (over 10 tons)", () => {
    expect(tripsFor(cartLoad([{ qty: 8, factors: gravel }]), MEDIUM_DUMP)).toBe(2);
  });

  it("fits exactly 18 yards of mulch in one trip", () => {
    // volume binds at exactly 1.0; weight is only 14,400 lb
    expect(tripsFor(cartLoad([{ qty: 18, factors: mulch }]), MEDIUM_DUMP)).toBe(1);
  });

  it("needs two trips for 19 yards of mulch", () => {
    expect(tripsFor(cartLoad([{ qty: 19, factors: mulch }]), MEDIUM_DUMP)).toBe(2);
  });

  it("fits exactly 6 pallets on the flatbed", () => {
    expect(tripsFor(cartLoad([{ qty: 6, factors: pavers }]), MEDIUM_FLATBED)).toBe(1);
  });

  it("needs two trips for 7 pallets", () => {
    expect(tripsFor(cartLoad([{ qty: 7, factors: pavers }]), MEDIUM_FLATBED)).toBe(2);
  });

  it("always books at least one trip for a small order", () => {
    expect(tripsFor(cartLoad([{ qty: 0.5, factors: mulch }]), MEDIUM_DUMP)).toBe(1);
  });

  it("books one trip when the method has no limits at all", () => {
    expect(tripsFor(cartLoad([{ qty: 500, factors: gravel }]), UNLIMITED)).toBe(1);
  });

  it("does not let float dust push an exact load into a second trip", () => {
    // 0.1 + 0.2 style accumulation across many lines must not read as 18.0000000004 yards
    const lines = Array.from({ length: 60 }, () => ({ qty: 0.3, factors: mulch }));
    expect(tripsFor(cartLoad(lines), MEDIUM_DUMP)).toBe(1);
  });

  it("scales past two trips", () => {
    expect(tripsFor(cartLoad([{ qty: 55, factors: mulch }]), MEDIUM_DUMP)).toBe(4);
  });
});

describe("tripsFor — mixed carts", () => {
  it("takes whichever material binds first", () => {
    // 5 yd mulch (4,000 lb) + 6 yd gravel (16,800 lb) = 11 yd, 20,800 lb → weight binds
    const load = cartLoad([
      { qty: 5, factors: mulch },
      { qty: 6, factors: gravel },
    ]);
    expect(load.yards).toBe(11);
    expect(load.weightLbs).toBe(20800);
    expect(tripsFor(load, MEDIUM_DUMP)).toBe(2);
  });

  it("respects an explicit yardsPerUnit on a weight-priced product", () => {
    // 10 tons of gravel sold by the ton: weight is exactly at the limit, volume 7 yd is under
    const load = cartLoad([{ qty: 10, factors: gravelByTon }]);
    expect(load.weightLbs).toBe(20000);
    expect(load.yards).toBe(7);
    expect(tripsFor(load, MEDIUM_DUMP)).toBe(1);
  });
});

describe("bindingDimension", () => {
  it("names weight for a gravel load", () => {
    expect(bindingDimension(cartLoad([{ qty: 7, factors: gravel }]), MEDIUM_DUMP)).toBe("weight");
  });

  it("names yards for a mulch load", () => {
    expect(bindingDimension(cartLoad([{ qty: 18, factors: mulch }]), MEDIUM_DUMP)).toBe("yards");
  });

  it("names pallets on the flatbed", () => {
    expect(bindingDimension(cartLoad([{ qty: 4, factors: pavers }]), MEDIUM_FLATBED)).toBe("pallets");
  });

  it("is null when nothing is limited", () => {
    expect(bindingDimension(cartLoad([{ qty: 4, factors: mulch }]), UNLIMITED)).toBeNull();
  });
});
