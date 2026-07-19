export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function dollarsToCents(input: string | number): number {
  const n = typeof input === "number" ? input : parseFloat(String(input).replace(/[$,]/g, ""));
  if (!isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export const UNIT_LABELS: Record<string, string> = {
  cubic_yard: "cu yd",
  half_yard: "½ yd",
  bag: "bag",
  cord: "cord",
  face_cord: "face cord",
  ton: "ton",
};

export function unitLabel(unit: string): string {
  return UNIT_LABELS[unit] ?? unit;
}
