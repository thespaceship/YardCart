"use client";

import { useActionState } from "react";
import { completeOnboarding, type OnboardingState } from "@/app/actions/onboarding";

const UNIT_LABELS: Record<string, string> = {
  cubic_yard: "cu yd",
  face_cord: "face cord",
  cord: "cord",
};

export default function OnboardingForm({
  templates,
  defaultEmail,
}: {
  templates: { idx: number; name: string; category: string; defaultPrice: string; unit: string }[];
  defaultEmail: string;
}) {
  const [state, formAction, pending] = useActionState(completeOnboarding, {} as OnboardingState);

  return (
    <form action={formAction} className="stack">
      {state.error && <div className="alert error">{state.error}</div>}

      <div className="card">
        <h2>1 — Your yard</h2>
        <label>Yard / business name</label>
        <input name="yardName" required placeholder="Cedar Ridge Landscape Supply" />
        <div className="field-row">
          <div>
            <label>Phone</label>
            <input name="phone" type="tel" />
          </div>
          <div>
            <label>Order notification email</label>
            <input name="email" type="email" defaultValue={defaultEmail} />
          </div>
        </div>
        <div className="field-row">
          <div>
            <label>City</label>
            <input name="city" />
          </div>
          <div style={{ maxWidth: 120 }}>
            <label>State</label>
            <input name="state" placeholder="OH" />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>2 — What you sell</h2>
        <p className="muted">Check what you carry and adjust prices. Add more products anytime.</p>
        <table>
          <tbody>
            {templates.map((t) => (
              <tr key={t.idx}>
                <td style={{ width: 30 }}>
                  <input
                    type="checkbox"
                    name={`tpl_${t.idx}`}
                    defaultChecked={t.category === "mulch" && t.idx < 2}
                    style={{ width: "auto" }}
                    aria-label={`Sell ${t.name}`}
                  />
                </td>
                <td>
                  {t.name} <span className="muted">per {UNIT_LABELS[t.unit] ?? t.unit}</span>
                </td>
                <td style={{ width: 130 }}>
                  <input
                    name={`tpl_price_${t.idx}`}
                    defaultValue={t.defaultPrice}
                    inputMode="decimal"
                    aria-label={`Price for ${t.name}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>3 — Delivery &amp; trucks</h2>
        <div className="field-row">
          <div>
            <label>Zone name</label>
            <input name="zoneName" defaultValue="Local delivery" />
          </div>
          <div>
            <label>Delivery fee ($)</label>
            <input name="deliveryFee" required inputMode="decimal" placeholder="45" />
          </div>
          <div>
            <label>Minimum order ($, optional)</label>
            <input name="minOrder" inputMode="decimal" placeholder="75" />
          </div>
        </div>
        <label>ZIP codes you deliver to</label>
        <textarea name="zipCodes" rows={2} required placeholder="43004, 43230, 43068, 43110" />
        <div className="field-row">
          <div style={{ flex: 2 }}>
            <label>Truck name</label>
            <input name="truckName" defaultValue="Truck 1" />
          </div>
          <div>
            <label>Capacity (yds/trip)</label>
            <input name="capacityYards" inputMode="decimal" defaultValue="10" />
          </div>
          <div>
            <label>Max trips/day</label>
            <input name="maxTripsPerDay" inputMode="numeric" defaultValue="6" />
          </div>
        </div>
      </div>

      <button className="btn big" disabled={pending}>
        {pending ? "Creating your yard…" : "Finish setup — go live"}
      </button>
    </form>
  );
}
