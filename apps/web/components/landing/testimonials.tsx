"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

import { Reveal } from "@/components/landing/reveal";
import { StatusBadge } from "@/components/landing/status-badge";
import { APP_NAME } from "@/packages/shared";

const QUOTES = [
  {
    name: "Pilot operator",
    quote: `We replaced three spreadsheets with ${APP_NAME}. Channel commissions and taxes finally match what Airbnb sends us.`,
    role: "STR operator — 12 units, Florida",
  },
  {
    name: "Pilot operator",
    quote:
      "Month-end close went from a week of manual work to an afternoon. The portfolio CSV export alone pays for it.",
    role: "Portfolio manager — mixed STR + LTR",
  },
  {
    name: "Pilot operator",
    quote:
      "Our accountant gets clean reports with tax breakdowns per line. No more back-and-forth about ADR or occupancy.",
    role: "Owner-operator — 6 properties",
  },
] as const;

export function Testimonials() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    offset: ["start end", "end start"],
    target: ref,
  });
  const bgY = useTransform(scrollYProgress, [0, 1], ["-12%", "12%"]);

  return (
    <section className="relative overflow-hidden py-32 md:py-44" id="stories" ref={ref}>
      <motion.p
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-[22vw] font-bold whitespace-nowrap text-mist/4 select-none will-change-transform"
        style={{ y: bgY }}
      >
        {APP_NAME.toUpperCase()}
      </motion.p>

      <div className="relative mx-auto max-w-6xl px-6">
        <Reveal className="mb-16 text-center">
          <p className="mb-4 text-ember text-xs font-medium tracking-[0.3em] uppercase">
            Early operators
          </p>
          <h2 className="font-display text-4xl font-bold tracking-tight md:text-6xl">
            Built with operators in the pilot.
          </h2>
        </Reveal>

        <div className="grid gap-6 md:grid-cols-3">
          {QUOTES.map((quote, i) => (
            <Reveal delay={i * 0.12} key={quote.quote}>
              <figure className="glass flex h-full flex-col justify-between rounded-2xl p-8 transition-transform duration-500 hover:-translate-y-2">
                <div>
                  <StatusBadge variant="shipped" />
                  <blockquote className="mt-4 text-mist/80">
                    &ldquo;{quote.quote}&rdquo;
                  </blockquote>
                </div>
                <figcaption className="mt-8">
                  <p className="font-display font-semibold">{quote.name}</p>
                  <p className="mt-1 text-mist/45 text-sm">{quote.role}</p>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
