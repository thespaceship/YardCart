import { describe, it, expect } from "vitest";
import {
  dailyCapacityYards,
  orderYards,
  computeDayLoads,
  availableDates,
  horizonKeys,
} from "@/lib/capacity";
import { addDays, localNow, keyToStoredDate, storedDateKey } from "@/lib/tz";

const trucks = [
  { capacityYards: 5, maxTripsPerDay: 6, active: true }, // 30
  { capacityYards: 14, maxTripsPerDay: 4, active: true }, // 56
  { capacityYards: 10, maxTripsPerDay: 6, active: false }, // ignored
];

const NOW = { dateKey: "2026-07-19", hour: 8 };

describe("tz helpers", () => {
  it("adds days across month boundaries", () => {
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDays("2026-07-01", -1)).toBe("2026-06-30");
  });
  it("round-trips stored dates", () => {
    expect(storedDateKey(keyToStoredDate("2026-07-19"))).toBe("2026-07-19");
  });
  it("computes local date/hour for a real timezone without crashing", () => {
    const n = localNow("America/New_York");
    expect(n.dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(n.hour).toBeGreaterThanOrEqual(0);
    expect(n.hour).toBeLessThan(24);
  });
  it("falls back to UTC on a bad timezone", () => {
    const n = localNow("Not/AZone");
    expect(n.dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("dailyCapacityYards", () => {
  it("sums active trucks only", () => {
    expect(dailyCapacityYards(trucks)).toBe(86);
  });
});

describe("orderYards", () => {
  it("floors at MIN_ORDER_YARDS for non-volume items", () => {
    expect(orderYards([{ unitSnap: "face_cord", qty: 3 }])).toBe(1);
  });
  it("sums volume items", () => {
    expect(orderYards([{ unitSnap: "cubic_yard", qty: 6 }, { unitSnap: "half_yard", qty: 2 }])).toBe(7);
  });
});

describe("availableDates", () => {
  const mkOrder = (dayOffset: number, yards: number, status = "SCHEDULED") => ({
    scheduledDate: keyToStoredDate(addDays(NOW.dateKey, dayOffset)),
    requestedDate: null,
    status,
    items: [{ unitSnap: "cubic_yard", qty: yards }],
  });

  const horizon = horizonKeys(NOW, 10);

  it("respects lead time", () => {
    const loads = computeDayLoads([], trucks, horizon);
    const dates = availableDates({
      now: NOW,
      minLeadDays: 2,
      maxAdvanceDays: 10,
      orderCutoffHour: 15,
      neededYards: 5,
      dayLoads: loads,
    });
    expect(dates[0]).toBe(addDays(NOW.dateKey, 2));
  });

  it("pushes lead by one day after the cutoff hour", () => {
    const loads = computeDayLoads([], trucks, horizon);
    const dates = availableDates({
      now: { ...NOW, hour: 16 },
      minLeadDays: 1,
      maxAdvanceDays: 10,
      orderCutoffHour: 15,
      neededYards: 5,
      dayLoads: loads,
    });
    expect(dates[0]).toBe(addDays(NOW.dateKey, 2));
  });

  it("excludes days without enough remaining capacity", () => {
    const loads = computeDayLoads([mkOrder(1, 84)], trucks, horizon);
    const dates = availableDates({
      now: NOW,
      minLeadDays: 1,
      maxAdvanceDays: 5,
      orderCutoffHour: 15,
      neededYards: 5,
      dayLoads: loads,
    });
    expect(dates).not.toContain(addDays(NOW.dateKey, 1));
    expect(dates.length).toBeGreaterThan(0);
  });

  it("ignores canceled orders in load computation", () => {
    const loads = computeDayLoads([mkOrder(1, 84, "CANCELED")], trucks, horizon);
    const dates = availableDates({
      now: NOW,
      minLeadDays: 1,
      maxAdvanceDays: 5,
      orderCutoffHour: 15,
      neededYards: 5,
      dayLoads: loads,
    });
    expect(dates).toContain(addDays(NOW.dateKey, 1));
  });
});
