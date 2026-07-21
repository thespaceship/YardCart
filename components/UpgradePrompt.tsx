import Link from "next/link";
import { PLANS } from "@/lib/billing";

/**
 * Shown in place of a gated page when a logged-in yard is below the required tier — this is the
 * moment they might actually upgrade, so link them straight to billing rather than 404-ing.
 */
export default function UpgradePrompt({ feature, required }: { feature: string; required: string }) {
  const planName = PLANS[required]?.name ?? required;
  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <h1>{feature}</h1>
      <div className="card">
        <h3>Upgrade to {planName} to unlock {feature.toLowerCase()}</h3>
        <p className="muted">
          {feature} is part of the {planName} plan. Upgrade your subscription to turn it on for
          your yard.
        </p>
        <Link className="btn" href="/app/billing">
          View plans
        </Link>
      </div>
    </div>
  );
}
