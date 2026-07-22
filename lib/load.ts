/**
 * How much truck a cart consumes, and how many trips it takes.
 *
 * A yard states its truck limits in whichever unit is natural for each material — "10 tons of
 * gravel or 18 yards of mulch" is one truck described two ways, not two separate caps. So rather
 * than track dimensions independently, we compute each dimension's *utilization* (load ÷ limit)
 * and take the hardest-binding one. Gravel is heavy and low-volume, so weight binds; mulch is
 * light and bulky, so volume binds. One formula, both cases right, and mixed carts fall out
 * conservatively without special-casing.
 *
 * A limit of 0 means "don't enforce this dimension" — the escape hatch for a yard whose stated
 * policy is looser than the physics (18 yards of wet topsoil really is over a 10-ton axle rating,
 * but it's their truck and their call).
 */

export type LoadDims = { yards: number; weightLbs: number; pallets: number };

export type LoadLimits = {
  maxYards: number;
  maxWeightLbs: number;
  maxPallets: number;
};

/** Per-unit load contribution of a product. */
export type LoadFactors = {
  unit: string;
  yardsPerUnit: number | null;
  weightLbsPerUnit: number;
  palletsPerUnit: number;
};

/**
 * Volume one unit occupies when the product doesn't state it explicitly.
 * Non-volume units (ton, bag, cord) return 0 — a yard selling gravel by the ton should set
 * yardsPerUnit if it wants that gravel to count against a volume limit.
 */
export function derivedYardsPerUnit(unit: string): number {
  switch (unit) {
    case "cubic_yard":
      return 1;
    case "half_yard":
      return 0.5;
    default:
      return 0;
  }
}

export function yardsPerUnitOf(p: Pick<LoadFactors, "unit" | "yardsPerUnit">): number {
  return p.yardsPerUnit ?? derivedYardsPerUnit(p.unit);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Total load of a set of priced lines. */
export function cartLoad(lines: { qty: number; factors: LoadFactors }[]): LoadDims {
  let yards = 0;
  let weightLbs = 0;
  let pallets = 0;
  for (const { qty, factors } of lines) {
    yards += qty * yardsPerUnitOf(factors);
    weightLbs += qty * factors.weightLbsPerUnit;
    pallets += qty * factors.palletsPerUnit;
  }
  return { yards: round2(yards), weightLbs: round2(weightLbs), pallets: round2(pallets) };
}

export function emptyLoad(): LoadDims {
  return { yards: 0, weightLbs: 0, pallets: 0 };
}

/**
 * Fraction of one delivery this load consumes, taking the hardest-binding dimension.
 * Dimensions with no limit set (0) are skipped. Returns 0 when no limit applies at all —
 * an unlimited method, which is how a yard that hasn't configured any of this still works.
 */
export function utilization(load: LoadDims, limits: LoadLimits): number {
  const ratios: number[] = [];
  if (limits.maxYards > 0) ratios.push(load.yards / limits.maxYards);
  if (limits.maxWeightLbs > 0) ratios.push(load.weightLbs / limits.maxWeightLbs);
  if (limits.maxPallets > 0) ratios.push(load.pallets / limits.maxPallets);
  if (ratios.length === 0) return 0;
  return Math.max(...ratios);
}

/**
 * Trips needed to carry `load` on a method with `limits`. Always at least 1 for a non-empty
 * cart — a delivery is a delivery even if it's half a yard.
 */
export function tripsFor(load: LoadDims, limits: LoadLimits): number {
  const u = utilization(load, limits);
  if (u <= 0) return 1;
  // guard against float dust making 18.000000000000004 yards into a second trip
  return Math.max(1, Math.ceil(round2(u) - 1e-9));
}

/** Which dimension forced the trip count — used to explain "needs 2 trips (weight)" in the UI. */
export function bindingDimension(
  load: LoadDims,
  limits: LoadLimits
): "yards" | "weight" | "pallets" | null {
  let best: { key: "yards" | "weight" | "pallets"; ratio: number } | null = null;
  const consider = (key: "yards" | "weight" | "pallets", value: number, limit: number) => {
    if (limit <= 0) return;
    const ratio = value / limit;
    if (!best || ratio > best.ratio) best = { key, ratio };
  };
  consider("yards", load.yards, limits.maxYards);
  consider("weight", load.weightLbs, limits.maxWeightLbs);
  consider("pallets", load.pallets, limits.maxPallets);
  return best ? (best as { key: "yards" | "weight" | "pallets" }).key : null;
}
