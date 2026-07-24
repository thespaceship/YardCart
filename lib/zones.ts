import type { Zone } from "@prisma/client";
import { zipDistanceMiles } from "./zipgeo";

export function normalizeZip(zip: string): string {
  const t = zip.trim();
  // accept "43004" or "43004-1234"; anything else stays as-is (and fails validation)
  const m = t.match(/^(\d{5})(-\d{4})?$/);
  return m ? m[1] : t;
}

export function isValidZip(zip: string): boolean {
  return /^\d{5}$/.test(normalizeZip(zip));
}

export function parseZipList(raw: string): string[] {
  // Accepts JSON array or comma/space/newline separated text
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.map((z) => normalizeZip(String(z))).filter(isValidZip);
  } catch {
    // fall through to text parsing
  }
  return raw
    .split(/[\s,;]+/)
    .map(normalizeZip)
    .filter(isValidZip);
}

export function zoneZips(zone: Pick<Zone, "zipCodes">): string[] {
  return parseZipList(zone.zipCodes);
}

/** Fields matchZone reads. radiusMiles/centerZip are optional so older callers and test stubs
 *  (which predate radius zones) still type-check and fall back to list matching. */
type ZoneMatchFields = Pick<Zone, "zipCodes" | "active" | "deliveryFeeCents"> &
  Partial<Pick<Zone, "radiusMiles" | "centerZip">>;

/**
 * Does this zone serve `zip`?
 *
 * A radius zone (radiusMiles > 0) serves any ZIP within that many miles of its center — the
 * zone's own centerZip, or the yard's ZIP when that's left blank. This is the default: a yard
 * says "we deliver within 30 miles" instead of listing ZIPs. A ZIP we can't place (not in the
 * centroid table, or an unset/invalid center) simply doesn't match — it never blocks by accident.
 *
 * A zone with radiusMiles 0 falls back to the explicit zipCodes list, the legacy behavior kept
 * for irregular service areas.
 */
function zoneServes(zone: ZoneMatchFields, zip: string, yardZip: string): boolean {
  const radius = zone.radiusMiles ?? 0;
  if (radius > 0) {
    const center = normalizeZip(zone.centerZip || yardZip);
    if (!isValidZip(center)) return false;
    const dist = zipDistanceMiles(center, zip);
    return dist !== null && dist <= radius;
  }
  return zoneZips(zone).includes(zip);
}

/**
 * Find the active zone serving a ZIP. If multiple match, cheapest delivery fee wins — which also
 * makes concentric radius rings work: a "within 15 mi / $50" and a "within 40 mi / $95" zone both
 * match a nearby ZIP, and the customer gets the $50. `yardZip` is the default radius center.
 */
export function matchZone<T extends ZoneMatchFields>(
  zones: T[],
  zip: string,
  yardZip = ""
): T | null {
  const z = normalizeZip(zip);
  if (!isValidZip(z)) return null;
  const matches = zones.filter((zone) => zone.active && zoneServes(zone, z, yardZip));
  if (matches.length === 0) return null;
  return matches.sort((a, b) => a.deliveryFeeCents - b.deliveryFeeCents)[0];
}
