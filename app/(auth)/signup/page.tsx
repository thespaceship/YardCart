import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { signup } from "@/app/actions/auth";
import AuthForm from "@/components/AuthForm";

export const metadata = { title: "Create account" };

export default async function SignupPage() {
  const user = await getSessionUser();
  if (user) redirect("/app");
  return (
    <div className="narrow" style={{ paddingTop: 64 }}>
      <div className="card">
        <h1>Start your 14-day free trial</h1>
        <p className="muted">
          No credit card required. You&apos;ll set up your yard, products, and delivery zones in
          about 10 minutes.
        </p>
        <AuthForm action={signup} mode="signup" />
      </div>
      <p className="muted" style={{ textAlign: "center", marginTop: 16 }}>
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </div>
  );
}
