import { describe, it, expect } from "vitest";
import { matchZone, parseZipList, isValidZip, normalizeZip } from "@/lib/zones";

const zone = (zips: string[], fee: number, active = true) => ({
  zipCodes: JSON.stringify(zips),
  deliveryFeeCents: fee,
  active,
});

describe("zip parsing", () => {
  it("parses JSON arrays", () => {
    expect(parseZipList('["43004","43230"]')).toEqual(["43004", "43230"]);
  });
  it("parses comma/space/newline separated text", () => {
    expect(parseZipList("43004, 43230\n43068;43110")).toEqual(["43004", "43230", "43068", "43110"]);
  });
  it("drops invalid zips", () => {
    expect(parseZipList("43004, abcde, 1234, 999999")).toEqual(["43004"]);
  });
  it("normalizes ZIP+4 by truncation", () => {
    expect(normalizeZip("43004-1234")).toBe("43004");
    expect(isValidZip("43004-1234")).toBe(true);
  });
});

describe("matchZone", () => {
  it("matches the zone containing the zip", () => {
    const z = matchZone([zone(["43004"], 4500), zone(["43062"], 8500)], "43004");
    expect(z?.deliveryFeeCents).toBe(4500);
  });
  it("returns null when no zone matches", () => {
    expect(matchZone([zone(["43004"], 4500)], "99999")).toBeNull();
  });
  it("ignores inactive zones", () => {
    expect(matchZone([zone(["43004"], 4500, false)], "43004")).toBeNull();
  });
  it("prefers the cheaper fee on overlap", () => {
    const z = matchZone([zone(["43004"], 8500), zone(["43004"], 4500)], "43004");
    expect(z?.deliveryFeeCents).toBe(4500);
  });
  it("rejects invalid zips", () => {
    expect(matchZone([zone(["43004"], 4500)], "4300")).toBeNull();
  });
});

// Distances used below (Columbus, OH area): 43004→43230 ≈ 4 mi, 43004→45402 (Dayton) ≈ 75 mi.
const radiusZone = (miles: number, fee: number, center = "", active = true) => ({
  zipCodes: "[]",
  deliveryFeeCents: fee,
  active,
  radiusMiles: miles,
  centerZip: center,
});

describe("matchZone — radius", () => {
  it("serves a ZIP inside the radius (center from yardZip)", () => {
    const z = matchZone([radiusZone(15, 5000)], "43230", "43004");
    expect(z?.deliveryFeeCents).toBe(5000);
  });
  it("rejects a ZIP outside the radius", () => {
    expect(matchZone([radiusZone(40, 9500)], "45402", "43004")).toBeNull();
  });
  it("uses the zone's own centerZip over the yard ZIP", () => {
    const z = matchZone([radiusZone(15, 5000, "43004")], "43230", "99999");
    expect(z?.deliveryFeeCents).toBe(5000);
  });
  it("returns null (never throws) for a center we can't place", () => {
    expect(matchZone([radiusZone(50, 5000)], "43230", "")).toBeNull();
    expect(matchZone([radiusZone(50, 5000, "00000")], "43230", "43004")).toBeNull();
  });
  it("returns null for a delivery ZIP not in the centroid table", () => {
    expect(matchZone([radiusZone(500, 5000)], "99999", "43004")).toBeNull();
  });
  it("cheapest ring wins where radius zones overlap", () => {
    const zones = [radiusZone(40, 9500), radiusZone(15, 5000)];
    expect(matchZone(zones, "43230", "43004")?.deliveryFeeCents).toBe(5000);
  });
  it("falls through to the wider ring when the inner one doesn't reach", () => {
    // ~75 mi out: only the 100-mi ring covers it, not the 15-mi ring.
    const zones = [radiusZone(15, 5000), radiusZone(100, 12000)];
    expect(matchZone(zones, "45402", "43004")?.deliveryFeeCents).toBe(12000);
  });
});
