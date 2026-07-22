import { describe, it, expect } from "vitest";
import {
  dailyTripsByMethod,
  dailyTripCapacity,
  remainingTripsFor,
  computeDayLoads,
  availableDates,
  horizonKeys,
  LEGACY_POOL,
  type TruckCapacity,
  type OrderLoad,
} from "@/lib/capacity";
import { addDays, dayOfWeek, localNow, keyToStoredDate, storedDateKey } from "@/lib/tz";

const DUMP = "m-dump";
const FLAT = "m-flat";

const trucks: TruckCapacity[] = [
  { maxTripsPerDay: 6, active: true, deliveryMethodId: DUMP },
  { maxTripsPerDay: 4, active: true, deliveryMethodId: DUMP },
  { maxTripsPerDay: 2, active: true, deliveryMethodId: FLAT },
  { maxTripsPerDay: 9, active: false, deliveryMethodId: DUMP }, // out of service
];

const NOW = { dateKey: "2026-07-19", hour: 8 };
const horizon = horizonKeys(NOW, 10);

const mkOrder = (
  dayOffset: number,
  tripCount: number,
  deliveryMethodId: string | null = DUMP,
  status = "SCHEDULED"
): OrderLoad => ({
  scheduledDate: keyToStoredDate(addDays(NOW.dateKey, dayOffset)),
  requestedDate: null,
  status,
  deliveryMethodId,
  tripCount,
});

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
  it("computes day of week", () => {
    expect(dayOfWeek("2026-07-19")).toBe(0); // Sunday
    expect(dayOfWeek("2026-07-20")).toBe(1); // Monday
  });
});

describe("dailyTripsByMethod", () => {
  it("pools trips per method, ignoring trucks out of service", () => {
    const byMethod = dailyTripsByMethod(trucks);
    expect(byMethod.get(DUMP)).toBe(10);
    expect(byMethod.get(FLAT)).toBe(2);
  });

  it("puts unassigned trucks in the legacy pool", () => {
    const byMethod = dailyTripsByMethod([{ maxTripsPerDay: 5, active: true, deliveryMethodId: null }]);
    expect(byMethod.get(LEGACY_POOL)).toBe(5);
  });

  it("totals across every method", () => {
    expect(dailyTripCapacity(trucks)).toBe(12);
  });
});

describe("computeDayLoads", () => {
  it("charges an order's trips against its own method only", () => {
    const loads = computeDayLoads([mkOrder(1, 3, DUMP)], trucks, horizon);
    const day = loads.get(addDays(NOW.dateKey, 1))!;
    expect(day.byMethod.get(DUMP)!.usedTrips).toBe(3);
    expect(day.byMethod.get(DUMP)!.remainingTrips).toBe(7);
    // the flatbed is untouched — this is the whole point of per-method pools
    expect(day.byMethod.get(FLAT)!.usedTrips).toBe(0);
    expect(day.byMethod.get(FLAT)!.remainingTrips).toBe(2);
  });

  it("counts a multi-trip order as multiple trips", () => {
    const loads = computeDayLoads([mkOrder(1, 2, FLAT)], trucks, horizon);
    expect(loads.get(addDays(NOW.dateKey, 1))!.byMethod.get(FLAT)!.remainingTrips).toBe(0);
  });

  it("ignores canceled orders", () => {
    const loads = computeDayLoads([mkOrder(1, 10, DUMP, "CANCELED")], trucks, horizon);
    expect(loads.get(addDays(NOW.dateKey, 1))!.usedTrips).toBe(0);
  });

  it("counts unscheduled orders on their requested date", () => {
    const loads = computeDayLoads(
      [
        {
          scheduledDate: null,
          requestedDate: keyToStoredDate(addDays(NOW.dateKey, 2)),
          status: "NEW",
          deliveryMethodId: DUMP,
          tripCount: 1,
        },
      ],
      trucks,
      horizon
    );
    expect(loads.get(addDays(NOW.dateKey, 2))!.byMethod.get(DUMP)!.usedTrips).toBe(1);
  });

  it("tracks orders booked on a method with no trucks, at zero capacity", () => {
    const loads = computeDayLoads([mkOrder(1, 2, "m-retired")], trucks, horizon);
    const slot = loads.get(addDays(NOW.dateKey, 1))!.byMethod.get("m-retired")!;
    expect(slot.usedTrips).toBe(2);
    expect(slot.capacityTrips).toBe(0);
    expect(slot.remainingTrips).toBe(0);
  });

  it("treats a tripCount of 0 as one trip", () => {
    const loads = computeDayLoads([mkOrder(1, 0, DUMP)], trucks, horizon);
    expect(loads.get(addDays(NOW.dateKey, 1))!.byMethod.get(DUMP)!.usedTrips).toBe(1);
  });
});

describe("remainingTripsFor", () => {
  it("is unlimited for a yard with no trucks at all", () => {
    const loads = computeDayLoads([], [], horizon);
    expect(remainingTripsFor(loads.get(addDays(NOW.dateKey, 1)), DUMP)).toBe(Infinity);
  });

  it("is unlimited for a method with no trucks, even when other methods have them", () => {
    // assigning trucks to methods is Pro-only, so an unmodeled method must not close the yard
    const loads = computeDayLoads([], trucks, horizon);
    expect(remainingTripsFor(loads.get(addDays(NOW.dateKey, 1)), "m-retired")).toBe(Infinity);
  });

  it("stays unlimited for a method carrying orders but no trucks", () => {
    const loads = computeDayLoads([mkOrder(1, 5, "m-retired")], trucks, horizon);
    expect(remainingTripsFor(loads.get(addDays(NOW.dateKey, 1)), "m-retired")).toBe(Infinity);
  });

  it("is unlimited beyond the computed horizon", () => {
    expect(remainingTripsFor(undefined, DUMP)).toBe(Infinity);
  });
});

describe("availableDates", () => {
  const base = {
    now: NOW,
    minLeadDays: 1,
    maxAdvanceDays: 10,
    orderCutoffHour: 15,
    neededTrips: 1,
    methodId: DUMP,
  };

  it("respects lead time", () => {
    const dates = availableDates({
      ...base,
      minLeadDays: 2,
      dayLoads: computeDayLoads([], trucks, horizon),
    });
    expect(dates[0]).toBe(addDays(NOW.dateKey, 2));
  });

  it("pushes lead by one day after the cutoff hour", () => {
    const dates = availableDates({
      ...base,
      now: { ...NOW, hour: 16 },
      dayLoads: computeDayLoads([], trucks, horizon),
    });
    expect(dates[0]).toBe(addDays(NOW.dateKey, 2));
  });

  it("excludes a day whose method pool is full", () => {
    const dates = availableDates({
      ...base,
      maxAdvanceDays: 5,
      dayLoads: computeDayLoads([mkOrder(1, 10, DUMP)], trucks, horizon),
    });
    expect(dates).not.toContain(addDays(NOW.dateKey, 1));
    expect(dates.length).toBeGreaterThan(0);
  });

  it("keeps a day open for the flatbed when only the dump pool is full", () => {
    // the regression the yards-based pool caused: one busy truck type closed the whole yard
    const dayLoads = computeDayLoads([mkOrder(1, 10, DUMP)], trucks, horizon);
    expect(availableDates({ ...base, methodId: DUMP, dayLoads })).not.toContain(
      addDays(NOW.dateKey, 1)
    );
    expect(availableDates({ ...base, methodId: FLAT, dayLoads })).toContain(
      addDays(NOW.dateKey, 1)
    );
  });

  it("needs room for every trip a multi-trip order requires", () => {
    // one flatbed trip left, but the order needs two
    const dayLoads = computeDayLoads([mkOrder(1, 1, FLAT)], trucks, horizon);
    expect(availableDates({ ...base, methodId: FLAT, neededTrips: 1, dayLoads })).toContain(
      addDays(NOW.dateKey, 1)
    );
    expect(availableDates({ ...base, methodId: FLAT, neededTrips: 2, dayLoads })).not.toContain(
      addDays(NOW.dateKey, 1)
    );
  });

  it("charges non-volume orders real capacity", () => {
    // previously a firewood or gravel order consumed zero yards and never filled a day
    const dayLoads = computeDayLoads([mkOrder(1, 2, FLAT)], trucks, horizon);
    expect(availableDates({ ...base, methodId: FLAT, dayLoads })).not.toContain(
      addDays(NOW.dateKey, 1)
    );
  });

  it("ignores canceled orders", () => {
    const dates = availableDates({
      ...base,
      maxAdvanceDays: 5,
      dayLoads: computeDayLoads([mkOrder(1, 10, DUMP, "CANCELED")], trucks, horizon),
    });
    expect(dates).toContain(addDays(NOW.dateKey, 1));
  });

  it("routes orders with no method into the legacy pool", () => {
    const legacyTrucks: TruckCapacity[] = [
      { maxTripsPerDay: 1, active: true, deliveryMethodId: null },
    ];
    const dayLoads = computeDayLoads([mkOrder(1, 1, null)], legacyTrucks, horizon);
    expect(availableDates({ ...base, methodId: null, dayLoads })).not.toContain(
      addDays(NOW.dateKey, 1)
    );
  });

  it("stays fully open for a yard with methods but no trucks assigned to them", () => {
    // Starter yards can configure delivery methods but cannot assign trucks (Pro feature).
    // Every date must remain bookable rather than the storefront quietly closing.
    const unassigned: TruckCapacity[] = [
      { maxTripsPerDay: 4, active: true, deliveryMethodId: null },
    ];
    const dayLoads = computeDayLoads([mkOrder(1, 3, DUMP)], unassigned, horizon);
    const dates = availableDates({ ...base, methodId: DUMP, neededTrips: 2, dayLoads });
    expect(dates).toContain(addDays(NOW.dateKey, 1));
    expect(dates.length).toBe(10);
  });

  it("excludes days closed by deliveryDays (weekends off)", () => {
    // NOW.dateKey (2026-07-19) is a Sunday; Mon-Fri only = [1,2,3,4,5]
    const dates = availableDates({
      ...base,
      dayLoads: computeDayLoads([], trucks, horizon),
      deliveryDays: [1, 2, 3, 4, 5],
    });
    for (const key of dates) {
      const dow = new Date(`${key}T12:00:00Z`).getUTCDay();
      expect(dow).not.toBe(0);
      expect(dow).not.toBe(6);
    }
    expect(dates.length).toBeGreaterThan(0);
  });

  it("treats an empty or omitted deliveryDays as no restriction", () => {
    const dayLoads = computeDayLoads([], trucks, horizon);
    expect(availableDates({ ...base, dayLoads, deliveryDays: [] })).toEqual(
      availableDates({ ...base, dayLoads })
    );
  });
});
