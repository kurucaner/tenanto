"use client";

import { type ReactNode } from "react";

import { LandingFooter } from "@/components/landing/footer";
import { LandingNav } from "@/components/landing/nav";
import { useLenis } from "@/hooks/use-lenis";

type MarketingLayoutProps = Readonly<{
  children: ReactNode;
  showAurora?: boolean;
}>;

export function MarketingLayout({ children, showAurora = false }: MarketingLayoutProps) {
  useLenis();

  return (
    <>
      <LandingNav />
      {showAurora ? (
        <>
          <div
            aria-hidden
            className="pointer-events-none fixed top-0 left-1/4 -z-10 h-[42rem] w-[42rem] animate-aurora rounded-full bg-glow/10 blur-[140px]"
          />
          <div
            aria-hidden
            className="pointer-events-none fixed top-1/3 -right-40 -z-10 h-[36rem] w-[36rem] animate-aurora rounded-full bg-ember/8 blur-[120px] [animation-delay:-7s]"
          />
        </>
      ) : null}
      {children}
      <LandingFooter />
    </>
  );
}
