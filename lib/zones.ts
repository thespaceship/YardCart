import type { Zone } from "@prisma/client";

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

/** Find the active zone serving a ZIP. If multiple match, cheapest delivery fee wins. */
export function matchZone<T extends Pick<Zone, "zipCodes" | "active" | "deliveryFeeCents">>(
  zones: T[],
  zip: string
): T | null {
  const z = normalizeZip(zip);
  if (!isValidZip(z)) return null;
  const matches = zones.filter((zone) => zone.active && zoneZips(zone).includes(z));
  if (matches.length === 0) return null;
  return matches.sort((a, b) => a.deliveryFeeCents - b.deliveryFeeCents)[0];
}
