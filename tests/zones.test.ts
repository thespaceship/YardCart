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
