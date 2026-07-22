import type { Metadata } from "next";
import { absoluteUrl } from "./seo";

export type Guide = {
  slug: string;
  title: string; // used for <h1> and <title>
  description: string; // meta description
  excerpt: string; // shown on the hub card
  emoji: string;
  updated: string; // ISO date
};

/** Single source of truth for the guides cluster — drives the hub, sitemap, and per-page metadata. */
export const GUIDES: Guide[] = [
  {
    slug: "when-to-order-mulch",
    title: "When to Order Mulch: A Seasonal Timing Guide",
    description:
      "The best time to order and spread mulch, why spring books up fast at supply yards, and how fall mulching differs. Plus how much to order.",
    excerpt:
      "Mid-to-late spring is prime mulching season — and exactly when yards get slammed. Here's when to order so you're not waiting a week for delivery.",
    emoji: "🌱",
    updated: "2026-07-22",
  },
  {
    slug: "face-cord-vs-full-cord",
    title: "Face Cord vs. Full Cord: Firewood Measurements Explained",
    description:
      "What a full cord, face cord, and rick of firewood actually mean, how their volumes compare, and how to avoid overpaying for stacked wood.",
    excerpt:
      "A full cord is 128 cubic feet. A “face cord” or “rick” can be a third of that — or less. Know the difference before you pay.",
    emoji: "🪵",
    updated: "2026-07-22",
  },
  {
    slug: "how-much-does-a-yard-weigh",
    title: "How Much Does a Yard of Mulch, Topsoil, or Gravel Weigh?",
    description:
      "Approximate weight of a cubic yard of mulch, compost, topsoil, gravel, and sand — and what that means for your truck, driveway, and delivery.",
    excerpt:
      "A yard of mulch is under half a ton; a yard of gravel is closer to a ton and a half. Here's what each material weighs and why it matters.",
    emoji: "⚖️",
    updated: "2026-07-22",
  },
  {
    slug: "bagged-vs-bulk-mulch",
    title: "Bagged vs. Bulk Mulch: How Many Bags Are in a Cubic Yard?",
    description:
      "One cubic yard equals about 13.5 bags of mulch. Here's the bag-to-yard math, the real cost comparison, and when bulk delivery wins.",
    excerpt:
      "It takes ~13.5 standard bags to equal one bulk yard — and once you need more than about 10 bags, bulk is usually cheaper. Here's the math.",
    emoji: "🛍️",
    updated: "2026-07-22",
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

/** Per-page metadata derived from the guide entry, so titles/canonicals stay in sync. */
export function guideMetadata(slug: string): Metadata {
  const g = getGuide(slug);
  if (!g) return {};
  const url = absoluteUrl(`/guides/${slug}`);
  return {
    title: g.title,
    description: g.description,
    alternates: { canonical: `/guides/${slug}` },
    openGraph: {
      title: g.title,
      description: g.description,
      url,
      type: "article",
    },
  };
}
