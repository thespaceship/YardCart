import type { Order, Truck } from "@prisma/client";
import { addDays, dayOfWeek, storedDateKey, type LocalNow } from "./tz";

/**
 * Day-level capacity, measured in truck *trips* per delivery method.
 *
 * Trips are the only unit that works across materials. The old model summed
 * capacityYards × maxTripsPerDay into one pool and charged each order its volume, which meant a
 * ton of gravel, a cord of firewood, and a pallet of pavers all consumed zero capacity — the
 * yard looked infinitely available for everything it didn't sell by the cubic yard. Since the
 * delivery engine already works out how many trips a cart needs (lib/load.ts), capacity becomes
 * a straight count: each method's trucks supply trips, each order consumes the trips it booked.
 *
 * Trucks with no method assigned supply the LEGACY pool, which orders with no method fall into.
 * That keeps a yard mid-migration working without a flag day.
 *
 * All "days" are yard-local calendar keys (YYYY-MM-DD) — see lib/tz.ts.
 */

/** Pool key for trucks and orders that predate delivery methods. */
export const LEGACY_POOL = "";

export type TruckCapacity = Pick<Truck, "maxTripsPerDay" | "active"> & {
  deliveryMethodId: string | null;
};

/** Trips per day each method can run, keyed by method id. */
export function dailyTripsByMethod(trucks: TruckCapacity[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of trucks) {
    if (!t.active) continue;
    const key = t.deliveryMethodId ?? LEGACY_POOL;
    out.set(key, (out.get(key) ?? 0) + t.maxTripsPerDay);
  }
  return out;
}

/** Total trips a yard can run in a day, across every method. */
export function dailyTripCapacity(trucks: TruckCapacity[]): number {
  let total = 0;
  for (const n of dailyTripsByMethod(trucks).values()) total += n;
  return total;
}

export type OrderLoad = Pick<Order, "scheduledDate" | "requestedDate" | "status"> & {
  deliveryMethodId: string | null;
  tripCount: number;
};

/** Orders count against the day they are scheduled for; unscheduled orders count on their requested date. */
export function effectiveDateKey(
  order: Pick<Order, "scheduledDate" | "requestedDate" | "status">
): string | null {
  if (order.status === "CANCELED") return null;
  const d = order.scheduledDate ?? order.requestedDate;
  return d ? storedDateKey(d) : null;
}

export type DayLoad = {
  dateKey: string;
  /** Trips used and available per method id. */
  byMethod: Map<string, { usedTrips: number; capacityTrips: number; remainingTrips: number }>;
  usedTrips: number;
  capacityTrips: number;
};

export function computeDayLoads(
  orders: OrderLoad[],
  trucks: TruckCapacity[],
  dayKeys: string[]
): Map<string, DayLoad> {
  const perMethod = dailyTripsByMethod(trucks);
  const totalCapacity = dailyTripCapacity(trucks);
  const map = new Map<string, DayLoad>();
  for (const key of dayKeys) {
    const byMethod = new Map<string, { usedTrips: number; capacityTrips: number; remainingTrips: number }>();
    for (const [methodId, capacityTrips] of perMethod) {
      byMethod.set(methodId, { usedTrips: 0, capacityTrips, remainingTrips: capacityTrips });
    }
    map.set(key, { dateKey: key, byMethod, usedTrips: 0, capacityTrips: totalCapacity });
  }

  for (const o of orders) {
    const key = effectiveDateKey(o);
    if (!key) continue;
    const load = map.get(key);
    if (!load) continue;
    const methodId = o.deliveryMethodId ?? LEGACY_POOL;
    const trips = Math.max(1, o.tripCount);
    let slot = load.byMethod.get(methodId);
    if (!slot) {
      // Order booked on a method that has no trucks assigned. Track the usage so the day still
      // reads as busy rather than empty; capacity 0 means the picker won't offer more.
      slot = { usedTrips: 0, capacityTrips: 0, remainingTrips: 0 };
      load.byMethod.set(methodId, slot);
    }
    slot.usedTrips += trips;
    slot.remainingTrips = Math.max(0, slot.capacityTrips - slot.usedTrips);
    load.usedTrips += trips;
  }
  return map;
}

/**
 * Trips still available on a day for a given method.
 *
 * A method with no trucks assigned is *unconstrained*, not full. Capacity is only enforced where
 * the yard has actually declared it — the same rule the delivery limits use, and the safe
 * direction to be wrong in: assigning trucks to methods is a Pro feature, so a Starter yard
 * configuring delivery methods would otherwise have every order rejected as "date filled up".
 */
export function remainingTripsFor(
  load: DayLoad | undefined,
  methodId: string | null
): number {
  if (!load) return Infinity;
  const slot = load.byMethod.get(methodId ?? LEGACY_POOL);
  if (!slot || slot.capacityTrips <= 0) return Infinity;
  return slot.remainingTrips;
}

/**
 * Available delivery date keys for the storefront picker, in yard-local time.
 * Applies lead time, cutoff hour, advance window, and remaining trips on the chosen method.
 */
export function availableDates(opts: {
  now: LocalNow;
  minLeadDays: number;
  maxAdvanceDays: number;
  orderCutoffHour: number;
  neededTrips: number;
  methodId: string | null;
  dayLoads: Map<string, DayLoad>;
  deliveryDays?: number[];
}): string[] {
  const {
    now, minLeadDays, maxAdvanceDays, orderCutoffHour,
    neededTrips, methodId, dayLoads, deliveryDays,
  } = opts;
  const out: string[] = [];
  let lead = minLeadDays;
  if (now.hour >= orderCutoffHour) lead += 1;
  const needed = Math.max(1, neededTrips);
  for (let i = lead; i <= maxAdvanceDays; i++) {
    const key = addDays(now.dateKey, i);
    if (deliveryDays && deliveryDays.length > 0 && !deliveryDays.includes(dayOfWeek(key))) continue;
    if (remainingTripsFor(dayLoads.get(key), methodId) >= needed) out.push(key);
  }
  return out;
}

/** Build the day-key horizon [today .. today+n] in yard-local time. */
export function horizonKeys(now: LocalNow, days: number): string[] {
  const keys: string[] = [];
  for (let i = 0; i <= days; i++) keys.push(addDays(now.dateKey, i));
  return keys;
}
