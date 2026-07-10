"use client";

import { BreadcrumbNav } from "@/components/landing/breadcrumb-nav";
import { CTABanner } from "@/components/landing/cta-banner";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { MarketingLayout } from "@/components/landing/marketing-layout";
import { PageHero } from "@/components/landing/page-hero";
import { PlatformFlowDiagram } from "@/components/landing/platform-flow-diagram";
import { RelatedLinks } from "@/components/landing/related-links";
import { SectionHeader } from "@/components/landing/section-header";
import { MARKETING_PAGES } from "@/lib/marketing-content";

const content = MARKETING_PAGES.platform!;

export function PlatformPageContent() {
  return (
    <MarketingLayout showAurora>
      <main>
        <BreadcrumbNav current="Platform" />
        <PageHero
          eyebrow={content.eyebrow}
          headline={content.headline}
          headlineAccent={content.headlineAccent}
          subhead={content.subhead}
        />

        <section className="pb-24">
          <div className="mx-auto max-w-6xl space-y-10 px-6">
            <SectionHeader
              body={content.sections[0]?.body}
              eyebrow={content.sections[0]?.eyebrow ?? "Architecture"}
              title={content.sections[0]?.title ?? "How it fits together"}
            />
            <PlatformFlowDiagram />
          </div>
        </section>

        <div className="space-y-24 pb-24 md:space-y-32">
          {content.sections.slice(1).map((section) => (
            <section key={section.title}>
              <div className="mx-auto max-w-6xl space-y-10 px-6">
                <SectionHeader
                  body={section.body}
                  eyebrow={section.eyebrow}
                  title={section.title}
                />
                {section.features ? <FeatureGrid features={section.features} /> : null}
              </div>
            </section>
          ))}
        </div>

        {content.relatedLinks ? <RelatedLinks links={content.relatedLinks} /> : null}
        <CTABanner />
      </main>
    </MarketingLayout>
  );
}
