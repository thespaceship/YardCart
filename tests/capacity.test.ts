import { describe, it, expect } from "vitest";
import {
  dailyCapacityYards,
  orderYards,
  computeDayLoads,
  availableDates,
  dateKey,
} from "@/lib/capacity";

const trucks = [
  { capacityYards: 5, maxTripsPerDay: 6, active: true }, // 30
  { capacityYards: 14, maxTripsPerDay: 4, active: true }, // 56
  { capacityYards: 10, maxTripsPerDay: 6, active: false }, // ignored
];

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
  const mkOrder = (dayOffset: number, yards: number) => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    return {
      scheduledDate: d,
      requestedDate: null,
      status: "SCHEDULED",
      items: [{ unitSnap: "cubic_yard", qty: yards }],
    };
  };

  const horizon = () => {
    const days: Date[] = [];
    for (let i = 0; i <= 10; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  };

  it("respects lead time", () => {
    const loads = computeDayLoads([], trucks, horizon());
    const now = new Date();
    now.setHours(8, 0, 0, 0); // before cutoff
    const dates = availableDates({
      now,
      minLeadDays: 2,
      maxAdvanceDays: 10,
      orderCutoffHour: 15,
      neededYards: 5,
      dayLoads: loads,
    });
    const first = new Date(now);
    first.setDate(first.getDate() + 2);
    expect(dates[0]).toBe(dateKey(first));
  });

  it("pushes lead by one day after the cutoff hour", () => {
    const loads = computeDayLoads([], trucks, horizon());
    const now = new Date();
    now.setHours(16, 0, 0, 0); // past 15:00 cutoff
    const dates = availableDates({
      now,
      minLeadDays: 1,
      maxAdvanceDays: 10,
      orderCutoffHour: 15,
      neededYards: 5,
      dayLoads: loads,
    });
    const first = new Date(now);
    first.setDate(first.getDate() + 2);
    expect(dates[0]).toBe(dateKey(first));
  });

  it("excludes days without enough remaining capacity", () => {
    // fill day+1 with 84 of 86 yards → a 5-yard order can't fit
    const loads = computeDayLoads([mkOrder(1, 84)], trucks, horizon());
    const now = new Date();
    now.setHours(8, 0, 0, 0);
    const dates = availableDates({
      now,
      minLeadDays: 1,
      maxAdvanceDays: 5,
      orderCutoffHour: 15,
      neededYards: 5,
      dayLoads: loads,
    });
    const blocked = new Date(now);
    blocked.setDate(blocked.getDate() + 1);
    expect(dates).not.toContain(dateKey(blocked));
    expect(dates.length).toBeGreaterThan(0);
  });

  it("ignores canceled orders in load computation", () => {
    const canceled = { ...mkOrder(1, 84), status: "CANCELED" };
    const loads = computeDayLoads([canceled], trucks, horizon());
    const now = new Date();
    now.setHours(8, 0, 0, 0);
    const dates = availableDates({
      now,
      minLeadDays: 1,
      maxAdvanceDays: 5,
      orderCutoffHour: 15,
      neededYards: 5,
      dayLoads: loads,
    });
    const day1 = new Date(now);
    day1.setDate(day1.getDate() + 1);
    expect(dates).toContain(dateKey(day1));
  });
});
