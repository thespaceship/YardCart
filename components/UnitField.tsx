"use client";

import { useState } from "react";

/**
 * The product "Unit" picker. Yards sell in wildly different units — cubic yards of mulch, tons of
 * gravel, but also bags, pallets, bricks, rolls of wire mesh, linear feet of edging. So we offer a
 * broad set of presets plus a "Custom…" escape hatch where the yard types whatever fits.
 *
 * The built-in presets keep canonical values (e.g. "cubic_yard") because the truck-load math keys
 * off them (lib/load.ts); a custom unit stores the free text and simply doesn't auto-derive a
 * volume. Either way the final value is posted through one hidden `unit` field, so the server
 * action reads it exactly as before.
 */
const PRESETS: [value: string, label: string][] = [
  ["cubic_yard", "Cubic yard"],
  ["half_yard", "Half yard"],
  ["ton", "Ton"],
  ["bag", "Bag"],
  ["each", "Each"],
  ["pallet", "Pallet"],
  ["piece", "Piece"],
  ["bundle", "Bundle"],
  ["roll", "Roll"],
  ["linear_foot", "Linear foot"],
  ["square_foot", "Square foot"],
  ["pound", "Pound"],
  ["cord", "Cord"],
  ["face_cord", "Face cord"],
];

const CUSTOM = "__custom__";
const presetValues = new Set(PRESETS.map(([v]) => v));

export default function UnitField({ defaultUnit }: { defaultUnit?: string }) {
  const initial = defaultUnit ?? "cubic_yard";
  const startsCustom = !presetValues.has(initial);
  const [choice, setChoice] = useState(startsCustom ? CUSTOM : initial);
  const [custom, setCustom] = useState(startsCustom ? initial : "");

  const isCustom = choice === CUSTOM;
  const resolved = isCustom ? custom.trim() : choice;

  return (
    <div>
      <label>Unit</label>
      {/* Carries the final value to the server action, custom or preset alike. */}
      <input type="hidden" name="unit" value={resolved} />
      <select
        value={choice}
        onChange={(e) => setChoice(e.target.value)}
        aria-label="Unit"
      >
        {PRESETS.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
        <option value={CUSTOM}>Custom…</option>
      </select>
      {isCustom && (
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          maxLength={24}
          required
          placeholder="e.g. brick, sheet, bag of sand"
          aria-label="Custom unit"
          style={{ marginTop: 6 }}
        />
      )}
    </div>
  );
}
