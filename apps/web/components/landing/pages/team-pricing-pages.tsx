"use client";

"use client";

import { BreadcrumbNav } from "@/components/landing/breadcrumb-nav";
import { CTABanner } from "@/components/landing/cta-banner";
import { MarketingLayout } from "@/components/landing/marketing-layout";
import { PageHero } from "@/components/landing/page-hero";
import { Reveal } from "@/components/landing/reveal";
import { SectionHeader } from "@/components/landing/section-header";
import { MARKETING_PAGES, PRICING_FAQ, TEAM_PERMISSIONS } from "@/lib/marketing-content";

const content = MARKETING_PAGES.team!;

export function TeamPageContent() {
  return (
    <MarketingLayout showAurora>
      <main>
        <BreadcrumbNav current="Team" />
        <PageHero
          eyebrow={content.eyebrow}
          headline={content.headline}
          headlineAccent={content.headlineAccent}
          subhead={content.subhead}
        />

        <div className="space-y-24 pb-24 md:space-y-32">
          {content.sections.map((section) => (
            <section key={section.title}>
              <div className="mx-auto max-w-6xl space-y-10 px-6">
                <SectionHeader body={section.body} eyebrow={section.eyebrow} title={section.title} />
              </div>
            </section>
          ))}

          <section>
            <div className="mx-auto max-w-6xl px-6">
              <Reveal>
                <div className="glass overflow-hidden rounded-2xl">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-mist/10">
                        <th className="px-6 py-4 font-display text-mist/50">Capability</th>
                        <th className="px-6 py-4 font-display text-mist/50">Owner</th>
                        <th className="px-6 py-4 font-display text-mist/50">Manager</th>
                        <th className="px-6 py-4 font-display text-mist/50">Accountant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {TEAM_PERMISSIONS.map((row) => (
                        <tr className="border-b border-mist/8 last:border-0" key={row.capability}>
                          <td className="px-6 py-4 text-mist/80">{row.capability}</td>
                          <td className="px-6 py-4 text-mist/60">{row.owner ? "✓" : "—"}</td>
                          <td className="px-6 py-4 text-mist/60">{row.manager ? "✓" : "—"}</td>
                          <td className="px-6 py-4 text-mist/60">{row.accountant ? "✓" : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Reveal>
            </div>
          </section>
        </div>

        <CTABanner />
      </main>
    </MarketingLayout>
  );
}

export function PricingPageContent() {
  const pricing = MARKETING_PAGES.pricing!;

  return (
    <MarketingLayout showAurora>
      <main>
        <BreadcrumbNav current="Pricing" />
        <PageHero
          eyebrow={pricing.eyebrow}
          headline={pricing.headline}
          headlineAccent={pricing.headlineAccent}
          subhead={pricing.subhead}
        />

        <div className="space-y-24 pb-24 md:space-y-32">
          {pricing.sections.map((section) => (
            <section key={section.title}>
              <div className="mx-auto max-w-3xl px-6">
                <SectionHeader
                  align="center"
                  body={section.body}
                  eyebrow={section.eyebrow}
                  title={section.title}
                />
              </div>
            </section>
          ))}

          <section>
            <div className="mx-auto max-w-3xl space-y-6 px-6">
              <SectionHeader align="center" eyebrow="FAQ" title="Common questions" />
              {PRICING_FAQ.map((item, index) => (
                <Reveal delay={index * 0.06} key={item.question}>
                  <div className="glass rounded-2xl p-6">
                    <h3 className="font-display font-semibold">{item.question}</h3>
                    <p className="mt-2 text-mist/60 text-sm">{item.answer}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>
        </div>

        <CTABanner />
      </main>
    </MarketingLayout>
  );
}
