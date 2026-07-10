"use client";

import { motion } from "motion/react";
import Link from "next/link";

import { Reveal } from "@/components/landing/reveal";

type PageHeroProps = Readonly<{
  eyebrow?: string;
  headline: string;
  headlineAccent?: string;
  primaryCta?: { href: string; label: string };
  secondaryCta?: { href: string; label: string };
  subhead: string;
}>;

export function PageHero({
  eyebrow,
  headline,
  headlineAccent,
  primaryCta = { href: "/contact", label: "Start free pilot" },
  secondaryCta = { href: "/platform", label: "See platform" },
  subhead,
}: PageHeroProps) {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-28">
      <div className="mx-auto max-w-4xl px-6 text-center">
        {eyebrow ? (
          <motion.p
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 text-ember text-xs font-medium tracking-[0.3em] uppercase"
            initial={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            {eyebrow}
          </motion.p>
        ) : null}
        <h1 className="font-display text-[clamp(2.2rem,6vw,4.5rem)] leading-[1.02] font-bold tracking-tight">
          {headline}
          {headlineAccent ? (
            <>
              <br />
              <span className="bg-gradient-to-r from-ember via-[#ff9d6b] to-glow bg-clip-text text-transparent">
                {headlineAccent}
              </span>
            </>
          ) : null}
        </h1>
        <Reveal>
          <p className="mx-auto mt-8 max-w-2xl text-base text-mist/60 md:text-lg">{subhead}</p>
        </Reveal>
        <Reveal className="mt-10 flex flex-wrap items-center justify-center gap-4" delay={0.1}>
          <Link
            className="rounded-full bg-mist px-8 py-4 font-display text-ink text-sm font-semibold transition-transform duration-300 hover:scale-105"
            href={primaryCta.href}
          >
            {primaryCta.label}
          </Link>
          <Link
            className="rounded-full border border-mist/20 px-8 py-4 font-display text-mist/80 text-sm font-semibold transition-colors duration-300 hover:border-mist/50 hover:text-mist"
            href={secondaryCta.href}
          >
            {secondaryCta.label}
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
