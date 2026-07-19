import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { login } from "@/app/actions/auth";
import AuthForm from "@/components/AuthForm";

export const metadata = { title: "Log in" };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/app");
  return (
    <div className="narrow" style={{ paddingTop: 64 }}>
      <div className="card">
        <h1>Log in</h1>
        <p className="muted">Welcome back to YardCart.</p>
        <AuthForm action={login} mode="login" />
      </div>
      <p className="muted" style={{ textAlign: "center", marginTop: 16 }}>
        New here? <Link href="/signup">Create your yard&apos;s account</Link>
        {" · "}
        <Link href="/">Back to site</Link>
      </p>
    </div>
  );
}
