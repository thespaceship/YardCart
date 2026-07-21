import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { PRODUCT_TEMPLATES } from "@/lib/templates";
import { normalizeTrialPlan } from "@/lib/billing";
import OnboardingForm from "@/components/OnboardingForm";

export const metadata = { title: "Set up your yard" };

export default async function OnboardingPage(props: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.yardId) redirect("/app");
  const plan = normalizeTrialPlan((await props.searchParams).plan);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <h1>Set up your yard</h1>
      <p className="muted">
        Three quick steps — you can change everything later. When you finish, your online ordering
        page is live.
      </p>
      <OnboardingForm
        templates={PRODUCT_TEMPLATES.map((t, idx) => ({
          idx,
          name: t.name,
          category: t.category,
          defaultPrice: (t.priceCents / 100).toFixed(2),
          unit: t.unit,
        }))}
        defaultEmail={user.email}
        plan={plan}
      />
    </div>
  );
}
