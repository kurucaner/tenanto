"use client";

import Link from "next/link";

import { BreadcrumbNav } from "@/components/landing/breadcrumb-nav";
import { CTABanner } from "@/components/landing/cta-banner";
import { MarketingLayout } from "@/components/landing/marketing-layout";
import { PageHero } from "@/components/landing/page-hero";
import { Reveal } from "@/components/landing/reveal";
import { SectionHeader } from "@/components/landing/section-header";
import { StatusBadge } from "@/components/landing/status-badge";
import { MARKETING_PAGES, ROADMAP_ITEMS } from "@/lib/marketing-content";

const content = MARKETING_PAGES.roadmap!;

export function RoadmapPageContent() {
  const nearTerm = ROADMAP_ITEMS.filter((item) => item.horizon === "near");
  const longTerm = ROADMAP_ITEMS.filter((item) => item.horizon === "long");

  return (
    <MarketingLayout showAurora>
      <main>
        <BreadcrumbNav current="Roadmap" />
        <PageHero
          eyebrow={content.eyebrow}
          headline={content.headline}
          headlineAccent={content.headlineAccent}
          subhead={content.subhead}
        />

        <div className="space-y-24 pb-24 md:space-y-32">
          {[
            { items: nearTerm, title: "Near-term" },
            { items: longTerm, title: "Long-term vision" },
          ].map((group) => (
            <section key={group.title}>
              <div className="mx-auto max-w-6xl space-y-10 px-6">
                <SectionHeader eyebrow="Roadmap" title={group.title} />
                <div className="grid gap-6 md:grid-cols-2">
                  {group.items.map((item, index) => (
                    <Reveal delay={index * 0.08} key={item.title}>
                      <article className="glass flex h-full flex-col rounded-2xl p-8">
                        <StatusBadge variant="coming-soon" />
                        <h3 className="mt-4 font-display text-xl font-bold">{item.title}</h3>
                        <p className="mt-3 flex-1 text-mist/60 text-sm leading-relaxed">
                          {item.body}
                        </p>
                        <Link
                          className="mt-6 font-display text-ember text-sm font-semibold transition-transform hover:translate-x-1"
                          href="/contact"
                        >
                          Notify me →
                        </Link>
                      </article>
                    </Reveal>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>

        <CTABanner
          description="Everything on our roadmap starts with operator feedback. Tell us what you need most."
          headline="Shape what we"
          headlineAccent="build next."
        />
      </main>
    </MarketingLayout>
  );
}
