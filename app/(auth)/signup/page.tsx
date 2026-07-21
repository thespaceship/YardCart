import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { signup } from "@/app/actions/auth";
import { PLANS, normalizeTrialPlan } from "@/lib/billing";
import AuthForm from "@/components/AuthForm";

export const metadata = { title: "Create account", robots: { index: false, follow: false } };

export default async function SignupPage(props: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/app");
  const plan = normalizeTrialPlan((await props.searchParams).plan);
  return (
    <div className="narrow" style={{ paddingTop: 64 }}>
      <div className="card">
        <h1>Start your 14-day free {PLANS[plan].name} trial</h1>
        <p className="muted">
          No credit card required. You&apos;ll set up your yard, products, and delivery zones in
          about 10 minutes.{" "}
          <Link href="/pricing">Change plan</Link>
        </p>
        <AuthForm action={signup} mode="signup" plan={plan} />
        <p className="muted" style={{ marginTop: 12, marginBottom: 0, fontSize: "0.85rem" }}>
          By creating an account you agree to the <Link href="/terms">Terms of Service</Link> and{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </div>
      <p className="muted" style={{ textAlign: "center", marginTop: 16 }}>
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </div>
  );
}
