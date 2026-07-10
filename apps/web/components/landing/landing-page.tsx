"use client";

import { CTABanner } from "@/components/landing/cta-banner";
import { DashboardShowcase } from "@/components/landing/dashboard-showcase";
import { ExploreFeatures } from "@/components/landing/explore-features";
import { Hero } from "@/components/landing/hero";
import { HorizontalStory } from "@/components/landing/horizontal-story";
import { MarketingLayout } from "@/components/landing/marketing-layout";
import { Marquee } from "@/components/landing/marquee";
import { Stats } from "@/components/landing/stats";
import { Testimonials } from "@/components/landing/testimonials";

export function LandingPage() {
  return (
    <MarketingLayout>
      <main>
        <Hero />
        <Marquee />
        <DashboardShowcase />
        <HorizontalStory />
        <Stats />
        <ExploreFeatures />
        <Testimonials />
        <CTABanner id="cta" />
      </main>
    </MarketingLayout>
  );
}
