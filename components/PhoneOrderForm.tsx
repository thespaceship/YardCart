"use client";

import { useActionState } from "react";
import { createPhoneOrder, type PhoneOrderState } from "@/app/actions/orders";

export default function PhoneOrderForm({
  products,
  methods,
}: {
  products: { id: string; name: string; unit: string; price: string; step: number }[];
  methods: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    createPhoneOrder,
    {} as PhoneOrderState
  );
  return (
    <form action={formAction} className="stack">
      {state.error && <div className="alert error">{state.error}</div>}
      <div className="card">
        <h3>Items</h3>
        <table>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.name} <span className="muted">({p.price} / {p.unit})</span>
                </td>
                <td style={{ width: 110 }}>
                  <input
                    name={`qty_${p.id}`}
                    inputMode="decimal"
                    placeholder="0"
                    step={p.step}
                    aria-label={`Quantity of ${p.name}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h3>Customer</h3>
        <div className="field-row">
          <div>
            <label>Name</label>
            <input name="customerName" required />
          </div>
          <div>
            <label>Phone</label>
            <input name="customerPhone" required type="tel" />
          </div>
        </div>
        <label>Email (optional)</label>
        <input name="customerEmail" type="email" />
        <div className="field-row">
          <div style={{ flex: 2 }}>
            <label>Street address</label>
            <input name="addressLine" required />
          </div>
          <div>
            <label>City</label>
            <input name="city" />
          </div>
          <div>
            <label>ZIP</label>
            <input name="zip" required inputMode="numeric" maxLength={5} />
          </div>
        </div>
        <div className="field-row">
          <div>
            <label>Requested date (optional)</label>
            <input name="requestedDate" type="date" />
          </div>
          {methods.length > 0 && (
            <div>
              <label>Delivery method</label>
              <select name="deliveryMethodId" defaultValue="">
                <option value="">Automatic — pick what the load needs</option>
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <label>Placement instructions</label>
        <input name="placementNotes" placeholder="Dump on driveway…" />
        <label>Internal notes</label>
        <input name="internalNotes" />
      </div>
      <button className="btn big" disabled={pending}>
        {pending ? "Creating…" : "Create order"}
      </button>
    </form>
  );
}
