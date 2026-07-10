"use client";

import { BreadcrumbNav } from "@/components/landing/breadcrumb-nav";
import { ChannelPills } from "@/components/landing/channel-pills";
import { CTABanner } from "@/components/landing/cta-banner";
import { DashboardMock, type TDashboardMockProps } from "@/components/landing/dashboard-mock";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { MarketingLayout } from "@/components/landing/marketing-layout";
import { PageHero } from "@/components/landing/page-hero";
import { RelatedLinks } from "@/components/landing/related-links";
import { Reveal } from "@/components/landing/reveal";
import { SectionHeader } from "@/components/landing/section-header";
import { type TMarketingPageContent } from "@/lib/marketing-content";

type MarketingFeaturePageProps = Readonly<{
  content: TMarketingPageContent;
  mock?: TDashboardMockProps;
  showChannels?: boolean;
}>;

export function MarketingFeaturePage({ content, mock, showChannels }: MarketingFeaturePageProps) {
  return (
    <MarketingLayout showAurora>
      <main>
        <BreadcrumbNav current={content.title} />
        <PageHero
          eyebrow={content.eyebrow}
          headline={content.headline}
          headlineAccent={content.headlineAccent}
          subhead={content.subhead}
        />

        {mock ? (
          <section className="pb-20">
            <div className="mx-auto max-w-6xl px-6">
              <Reveal>
                <DashboardMock {...mock} />
              </Reveal>
            </div>
          </section>
        ) : null}

        {showChannels ? (
          <section className="pb-16">
            <div className="mx-auto max-w-6xl px-6">
              <Reveal>
                <ChannelPills />
              </Reveal>
            </div>
          </section>
        ) : null}

        <div className="space-y-24 pb-24 md:space-y-32">
          {content.sections.map((section) => (
            <section key={section.title}>
              <div className="mx-auto max-w-6xl space-y-10 px-6">
                <SectionHeader body={section.body} eyebrow={section.eyebrow} title={section.title} />
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
