"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Material = "mulch" | "soil" | "gravel" | "sand";

const MATERIALS: Record<
  Material,
  { label: string; depth: number; lbsPerYard: number; tip: string }
> = {
  mulch: {
    label: "Mulch",
    depth: 3,
    lbsPerYard: 800,
    tip: "2–3 in to refresh beds, 3–4 in for weed suppression and moisture.",
  },
  soil: {
    label: "Topsoil / Compost",
    depth: 3,
    lbsPerYard: 2000,
    tip: "1–2 in to top-dress a lawn, 4–6 in for new garden beds.",
  },
  gravel: {
    label: "Gravel / Stone",
    depth: 2,
    lbsPerYard: 2800,
    tip: "2–3 in for walkways and decorative beds, ~4 in for driveways.",
  },
  sand: {
    label: "Sand / Fill",
    depth: 2,
    lbsPerYard: 2600,
    tip: "1 in as a paver base leveling course; deeper for bedding.",
  },
};

/** Round up to the nearest half cubic yard (how a yard actually sells material). */
function roundToHalfYard(yards: number): number {
  return Math.max(0.5, Math.ceil(yards * 2) / 2);
}

function num(v: string): number {
  const n = parseFloat(v);
  return isFinite(n) ? n : NaN;
}

export default function YardageCalculator() {
  const [material, setMaterial] = useState<Material>("mulch");
  const [shape, setShape] = useState<"rectangle" | "circle">("rectangle");
  const [length, setLength] = useState("20");
  const [width, setWidth] = useState("10");
  const [diameter, setDiameter] = useState("12");
  const [depth, setDepth] = useState("3");

  function pickMaterial(m: Material) {
    setMaterial(m);
    setDepth(String(MATERIALS[m].depth));
  }

  const result = useMemo(() => {
    const d = num(depth);
    let areaSqft: number;
    if (shape === "rectangle") {
      const l = num(length);
      const w = num(width);
      if (!(l > 0) || !(w > 0)) return null;
      areaSqft = l * w;
    } else {
      const dia = num(diameter);
      if (!(dia > 0)) return null;
      areaSqft = Math.PI * (dia / 2) ** 2;
    }
    if (!(d > 0)) return null;

    const exactYards = (areaSqft * (d / 12)) / 27;
    const orderYards = roundToHalfYard(exactYards);
    const bags2cuft = Math.ceil((exactYards * 27) / 2); // 2 cu ft bags
    const weightLbs = Math.round(orderYards * MATERIALS[material].lbsPerYard);
    const coverageAtDepth = Math.round(324 / d); // sqft one cubic yard covers at this depth

    return { areaSqft, exactYards, orderYards, bags2cuft, weightLbs, coverageAtDepth };
  }, [shape, length, width, diameter, depth, material]);

  const depthChips = ["2", "3", "4", "6"];

  return (
    <div className="card" style={{ padding: 24 }}>
      {/* Material */}
      <label style={{ marginTop: 0 }}>Material</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
        {(Object.keys(MATERIALS) as Material[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => pickMaterial(m)}
            className={material === m ? "btn small" : "btn small secondary"}
            aria-pressed={material === m}
          >
            {MATERIALS[m].label}
          </button>
        ))}
      </div>
      <p className="muted" style={{ margin: "6px 0 18px", fontSize: "0.85rem" }}>
        💡 {MATERIALS[material].tip}
      </p>

      {/* Shape */}
      <label>Bed shape</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
        <button
          type="button"
          onClick={() => setShape("rectangle")}
          className={shape === "rectangle" ? "btn small" : "btn small secondary"}
          aria-pressed={shape === "rectangle"}
        >
          ▭ Rectangle
        </button>
        <button
          type="button"
          onClick={() => setShape("circle")}
          className={shape === "circle" ? "btn small" : "btn small secondary"}
          aria-pressed={shape === "circle"}
        >
          ◯ Round
        </button>
      </div>

      {/* Dimensions */}
      <div className="grid2" style={{ marginTop: 8 }}>
        {shape === "rectangle" ? (
          <>
            <div>
              <label htmlFor="calc-length">Length (feet)</label>
              <input
                id="calc-length"
                type="number"
                inputMode="decimal"
                min="0"
                value={length}
                onChange={(e) => setLength(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="calc-width">Width (feet)</label>
              <input
                id="calc-width"
                type="number"
                inputMode="decimal"
                min="0"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
              />
            </div>
          </>
        ) : (
          <div>
            <label htmlFor="calc-diameter">Diameter (feet)</label>
            <input
              id="calc-diameter"
              type="number"
              inputMode="decimal"
              min="0"
              value={diameter}
              onChange={(e) => setDiameter(e.target.value)}
            />
          </div>
        )}
        <div>
          <label htmlFor="calc-depth">Depth (inches)</label>
          <input
            id="calc-depth"
            type="number"
            inputMode="decimal"
            min="0"
            value={depth}
            onChange={(e) => setDepth(e.target.value)}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            {depthChips.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setDepth(c)}
                className={depth === c ? "btn small" : "btn small secondary"}
                style={{ padding: "2px 10px" }}
              >
                {c}&quot;
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Result */}
      <div
        style={{
          marginTop: 22,
          padding: 20,
          borderRadius: 12,
          background: "var(--brand-soft)",
          textAlign: "center",
        }}
      >
        {result ? (
          <>
            <div className="muted" style={{ fontSize: "0.85rem" }}>
              You need approximately
            </div>
            <div style={{ fontSize: "2.6rem", fontWeight: 800, color: "var(--brand)", lineHeight: 1.1 }}>
              {result.orderYards} cu yd
            </div>
            <div className="muted" style={{ fontSize: "0.85rem", marginBottom: 14 }}>
              (exact: {result.exactYards.toFixed(2)} yd³ — rounded up to the half-yard yards sell in)
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                flexWrap: "wrap",
                gap: 20,
                fontSize: "0.9rem",
              }}
            >
              <span>
                <strong>{result.areaSqft.toFixed(0)}</strong> sq ft area
              </span>
              <span>
                ≈ <strong>{result.bags2cuft}</strong> bags <span className="muted">(2 cu ft)</span>
              </span>
              <span>
                ≈ <strong>{result.weightLbs.toLocaleString()}</strong> lbs
              </span>
            </div>
            <p className="muted" style={{ fontSize: "0.8rem", margin: "12px 0 0" }}>
              At {depth}&quot; deep, one cubic yard covers about {result.coverageAtDepth} sq ft.
            </p>
          </>
        ) : (
          <div className="muted">Enter your bed size and depth to see cubic yards needed.</div>
        )}
      </div>

      {/* CTA */}
      <div style={{ marginTop: 18, textAlign: "center" }}>
        <p className="muted" style={{ fontSize: "0.9rem", marginBottom: 10 }}>
          Ready to order? Skip the phone tag — get instant delivery pricing by ZIP.
        </p>
        <Link href="/s/cedar-ridge-demo" className="btn">
          See it on a live ordering page →
        </Link>
      </div>
    </div>
  );
}
