import Link from "next/link";

import { Reveal } from "@/components/landing/reveal";
import { type TFeatureItem } from "@/lib/marketing-content";

const ACCENT_MAP = {
  ember: "from-ember/25",
  glow: "from-glow/25",
  mint: "from-mint/25",
} as const;

type FeatureGridProps = Readonly<{
  features: TFeatureItem[];
  hrefs?: readonly string[];
}>;

export function FeatureGrid({ features, hrefs }: FeatureGridProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {features.map((feature, index) => {
        const href = hrefs?.[index];
        const card = (
          <article
            className={`group flex h-full flex-col rounded-3xl border border-mist/10 bg-gradient-to-br ${ACCENT_MAP[feature.accent]} to-ink-2 p-8 transition-transform duration-500 hover:scale-[1.015]`}
          >
            <span className="text-3xl">{feature.icon}</span>
            <h3 className="mt-6 font-display text-xl font-bold tracking-tight md:text-2xl">
              {feature.title}
            </h3>
            <p className="mt-3 text-mist/60 text-sm leading-relaxed">{feature.body}</p>
            {href ? (
              <span className="mt-auto pt-6 font-display text-ember text-sm font-semibold transition-transform duration-300 group-hover:translate-x-1">
                Learn more →
              </span>
            ) : null}
          </article>
        );

        return (
          <Reveal delay={index * 0.08} key={feature.title}>
            {href ? (
              <Link className="block h-full" href={href}>
                {card}
              </Link>
            ) : (
              card
            )}
          </Reveal>
        );
      })}
    </div>
  );
}
