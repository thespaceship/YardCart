"use client";

import { useState } from "react";

/**
 * The "who does this zone serve" part of the zone form. Two modes:
 *
 *  - Radius (default): the yard enters a distance and we serve every address within that many
 *    miles of the center ZIP — no ZIP lists to maintain. This is what almost everyone wants.
 *  - Specific ZIP codes: the legacy list, kept behind a toggle for irregular service areas.
 *
 * The selected mode is posted as `areaType`; upsertZone reads it to decide which fields to trust.
 */
export default function ZoneAreaFields({
  yardZip,
  defaultMode,
  radiusMiles,
  centerZip,
  zipCodesText,
}: {
  yardZip: string;
  defaultMode: "radius" | "list";
  radiusMiles?: number;
  centerZip?: string;
  zipCodesText?: string;
}) {
  const [mode, setMode] = useState<"radius" | "list">(defaultMode);

  const tab = (value: "radius" | "list", label: string) => {
    const active = mode === value;
    return (
      <button
        type="button"
        onClick={() => setMode(value)}
        aria-pressed={active}
        style={{
          flex: 1,
          padding: "9px 12px",
          fontSize: "0.9rem",
          fontWeight: 600,
          cursor: "pointer",
          border: "1px solid var(--line)",
          background: active ? "var(--brand-soft)" : "var(--surface)",
          color: active ? "var(--brand-dark)" : "var(--ink-soft)",
          borderColor: active ? "var(--brand)" : "var(--line)",
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div>
      <input type="hidden" name="areaType" value={mode} />
      <label>Delivery area</label>
      <div style={{ display: "flex", gap: 0, borderRadius: 8, overflow: "hidden", maxWidth: 420 }}>
        {tab("radius", "By distance")}
        {tab("list", "Specific ZIP codes")}
      </div>

      {mode === "radius" ? (
        <div style={{ marginTop: 12 }}>
          <div className="field-row">
            <div>
              <label>Delivery radius (miles)</label>
              <input
                name="radiusMiles"
                inputMode="decimal"
                required
                defaultValue={radiusMiles && radiusMiles > 0 ? String(radiusMiles) : ""}
                placeholder="25"
              />
            </div>
            <div>
              <label>Center ZIP code</label>
              <input
                name="centerZip"
                inputMode="numeric"
                defaultValue={centerZip ?? ""}
                placeholder={yardZip || "e.g. 43004"}
              />
            </div>
          </div>
          <p className="muted" style={{ margin: "4px 0 0", maxWidth: 640 }}>
            We serve every address within this many miles of the center ZIP. Leave the center blank
            to measure from your yard&apos;s ZIP{yardZip ? ` (${yardZip})` : ""}.
          </p>
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <label>ZIP codes served (comma or space separated)</label>
          <textarea
            name="zipCodes"
            rows={2}
            defaultValue={zipCodesText ?? ""}
            placeholder="43004, 43230, 43068"
          />
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Only needed for oddly shaped areas. Most yards should use <strong>By distance</strong>.
          </p>
        </div>
      )}
    </div>
  );
}
