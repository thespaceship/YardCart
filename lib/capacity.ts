import type { Order, Truck } from "@prisma/client";
import { lineYards } from "./pricing";

/**
 * Day-level capacity model (MVP):
 * A yard's daily deliverable volume = sum over active trucks of capacityYards * maxTripsPerDay.
 * An order consumes its total volume-equivalent yards (non-volume units consume a
 * conservative 1 trip-equivalent handled via MIN_ORDER_YARDS floor).
 */
export const MIN_ORDER_YARDS = 1; // every delivery consumes at least this much daily capacity

export function dailyCapacityYards(trucks: Pick<Truck, "capacityYards" | "maxTripsPerDay" | "active">[]): number {
  return trucks
    .filter((t) => t.active)
    .reduce((s, t) => s + t.capacityYards * t.maxTripsPerDay, 0);
}

export function orderYards(items: { unitSnap: string; qty: number }[]): number {
  const yards = items.reduce((s, i) => s + lineYards(i.unitSnap, i.qty), 0);
  return Math.max(MIN_ORDER_YARDS, yards);
}

export type DayLoad = { dateKey: string; usedYards: number; capacityYards: number; remainingYards: number };

export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Orders count against the day they are scheduled for; unscheduled orders count on their requested date. */
export function effectiveDate(order: Pick<Order, "scheduledDate" | "requestedDate" | "status">): Date | null {
  if (order.status === "CANCELED") return null;
  return order.scheduledDate ?? order.requestedDate ?? null;
}

export function computeDayLoads(
  orders: (Pick<Order, "scheduledDate" | "requestedDate" | "status"> & {
    items: { unitSnap: string; qty: number }[];
  })[],
  trucks: Pick<Truck, "capacityYards" | "maxTripsPerDay" | "active">[],
  days: Date[]
): Map<string, DayLoad> {
  const capacity = dailyCapacityYards(trucks);
  const map = new Map<string, DayLoad>();
  for (const d of days) {
    map.set(dateKey(d), {
      dateKey: dateKey(d),
      usedYards: 0,
      capacityYards: capacity,
      remainingYards: capacity,
    });
  }
  for (const o of orders) {
    const d = effectiveDate(o);
    if (!d) continue;
    const key = dateKey(d);
    const load = map.get(key);
    if (!load) continue;
    load.usedYards += orderYards(o.items);
    load.remainingYards = Math.max(0, load.capacityYards - load.usedYards);
  }
  return map;
}

/**
 * Available delivery dates for the storefront date picker.
 * Applies lead time, cutoff hour, advance window, and remaining capacity.
 */
export function availableDates(opts: {
  now: Date;
  minLeadDays: number;
  maxAdvanceDays: number;
  orderCutoffHour: number;
  neededYards: number;
  dayLoads: Map<string, DayLoad>;
}): string[] {
  const { now, minLeadDays, maxAdvanceDays, orderCutoffHour, neededYards, dayLoads } = opts;
  const out: string[] = [];
  let lead = minLeadDays;
  if (now.getHours() >= orderCutoffHour) lead += 1;
  for (let i = lead; i <= maxAdvanceDays; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const key = dateKey(d);
    const load = dayLoads.get(key);
    const remaining = load ? load.remainingYards : Infinity;
    if (remaining >= Math.max(MIN_ORDER_YARDS, neededYards)) out.push(key);
  }
  return out;
}
