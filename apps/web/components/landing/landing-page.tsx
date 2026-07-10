"use client";

import { type ReactNode } from "react";

import { CTA } from "@/components/landing/cta";
import { DashboardShowcase } from "@/components/landing/dashboard-showcase";
import { LandingFooter } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { HorizontalStory } from "@/components/landing/horizontal-story";
import { Marquee } from "@/components/landing/marquee";
import { LandingNav } from "@/components/landing/nav";
import { Stats } from "@/components/landing/stats";
import { Testimonials } from "@/components/landing/testimonials";
import { useLenis } from "@/hooks/use-lenis";

type LandingPageProps = Readonly<{
  purposeSection?: ReactNode;
}>;

export function LandingPage({ purposeSection }: LandingPageProps) {
  useLenis();

  return (
    <>
      <LandingNav />
      <main>
        <Hero />
        {purposeSection}
        <Marquee />
        <DashboardShowcase />
        <HorizontalStory />
        <Stats />
        <Testimonials />
        <CTA />
      </main>
      <LandingFooter />
    </>
  );
}
