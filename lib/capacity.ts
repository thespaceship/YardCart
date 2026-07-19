import type { Order, Truck } from "@prisma/client";
import { lineYards } from "./pricing";
import { addDays, storedDateKey, type LocalNow } from "./tz";

/**
 * Day-level capacity model (MVP):
 * A yard's daily deliverable volume = sum over active trucks of capacityYards * maxTripsPerDay.
 * An order consumes its volume-equivalent yards, floored at MIN_ORDER_YARDS so every
 * delivery consumes at least one trip-equivalent slice of the day.
 * All "days" are yard-local calendar keys (YYYY-MM-DD) — see lib/tz.ts.
 */
export const MIN_ORDER_YARDS = 1;

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

/** Orders count against the day they are scheduled for; unscheduled orders count on their requested date. */
export function effectiveDateKey(
  order: Pick<Order, "scheduledDate" | "requestedDate" | "status">
): string | null {
  if (order.status === "CANCELED") return null;
  const d = order.scheduledDate ?? order.requestedDate;
  return d ? storedDateKey(d) : null;
}

export function computeDayLoads(
  orders: (Pick<Order, "scheduledDate" | "requestedDate" | "status"> & {
    items: { unitSnap: string; qty: number }[];
  })[],
  trucks: Pick<Truck, "capacityYards" | "maxTripsPerDay" | "active">[],
  dayKeys: string[]
): Map<string, DayLoad> {
  const capacity = dailyCapacityYards(trucks);
  const map = new Map<string, DayLoad>();
  for (const key of dayKeys) {
    map.set(key, { dateKey: key, usedYards: 0, capacityYards: capacity, remainingYards: capacity });
  }
  for (const o of orders) {
    const key = effectiveDateKey(o);
    if (!key) continue;
    const load = map.get(key);
    if (!load) continue;
    load.usedYards += orderYards(o.items);
    load.remainingYards = Math.max(0, load.capacityYards - load.usedYards);
  }
  return map;
}

/**
 * Available delivery date keys for the storefront picker, in yard-local time.
 * Applies lead time, cutoff hour, advance window, and remaining capacity.
 */
export function availableDates(opts: {
  now: LocalNow;
  minLeadDays: number;
  maxAdvanceDays: number;
  orderCutoffHour: number;
  neededYards: number;
  dayLoads: Map<string, DayLoad>;
}): string[] {
  const { now, minLeadDays, maxAdvanceDays, orderCutoffHour, neededYards, dayLoads } = opts;
  const out: string[] = [];
  let lead = minLeadDays;
  if (now.hour >= orderCutoffHour) lead += 1;
  for (let i = lead; i <= maxAdvanceDays; i++) {
    const key = addDays(now.dateKey, i);
    const load = dayLoads.get(key);
    const remaining = load ? load.remainingYards : Infinity;
    if (remaining >= Math.max(MIN_ORDER_YARDS, neededYards)) out.push(key);
  }
  return out;
}

/** Build the day-key horizon [today .. today+n] in yard-local time. */
export function horizonKeys(now: LocalNow, days: number): string[] {
  const keys: string[] = [];
  for (let i = 0; i <= days; i++) keys.push(addDays(now.dateKey, i));
  return keys;
}
