"use client";

import { motion, useScroll, useTransform } from "motion/react";
import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";

import { HOME_FEATURE_HREFS, HOME_FEATURE_LINKS } from "@/lib/marketing-content";

const ACCENT_MAP = {
  ember: "from-ember/25",
  glow: "from-glow/25",
  mint: "from-mint/25",
} as const;

const PANELS = HOME_FEATURE_LINKS.map((feature, index) => ({
  accent: ACCENT_MAP[feature.accent],
  body: feature.body,
  href: HOME_FEATURE_HREFS[index] ?? "/platform",
  icon: feature.icon,
  kicker: `0${index + 1} — ${feature.title.split(" ")[0]}`,
  title: feature.title,
}));

/** Vertical scroll drives a cinematic horizontal pan across four story panels. */
export function HorizontalStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);

  useLayoutEffect(() => {
    const measure = () => {
      if (trackRef.current) {
        setDistance(trackRef.current.scrollWidth - window.innerWidth);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const { scrollYProgress } = useScroll({ target: sectionRef });
  const x = useTransform(scrollYProgress, [0, 1], [0, -distance]);

  return (
    <section className="relative h-[380vh]" id="features" ref={sectionRef}>
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <motion.div
          className="flex gap-8 pr-[10vw] pl-[8vw] will-change-transform"
          ref={trackRef}
          style={{ x }}
        >
          <div className="flex w-[42vw] min-w-[320px] shrink-0 flex-col justify-center">
            <p className="mb-4 text-ember text-xs font-medium tracking-[0.3em] uppercase">
              How it works
            </p>
            <h2 className="font-display text-4xl font-bold tracking-tight md:text-6xl">
              Four pillars.
              <br />
              One ledger.
            </h2>
            <p className="mt-6 max-w-sm text-mist/50">
              Keep scrolling — each panel links to a deep dive.
            </p>
          </div>

          {PANELS.map((panel) => (
            <Link
              className={`group relative flex h-[68vh] w-[58vw] min-w-[420px] max-w-[720px] shrink-0 flex-col justify-end overflow-hidden rounded-3xl border border-mist/10 bg-gradient-to-br ${panel.accent} to-ink-2 p-10 transition-transform duration-500 hover:scale-[1.015]`}
              href={panel.href}
              key={panel.title}
            >
              <span className="absolute top-10 left-10 text-5xl opacity-80 transition-transform duration-500 group-hover:scale-125 group-hover:rotate-6">
                {panel.icon}
              </span>
              <span className="absolute -top-10 -right-6 font-display text-[11rem] font-bold text-mist/5 select-none">
                {panel.kicker.slice(0, 2)}
              </span>
              <p className="mb-3 text-mist/50 text-xs font-medium tracking-[0.3em] uppercase">
                {panel.kicker}
              </p>
              <h3 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
                {panel.title}
              </h3>
              <p className="mt-4 max-w-md text-mist/60">{panel.body}</p>
              <span className="mt-6 font-display text-ember text-sm font-semibold transition-transform group-hover:translate-x-1">
                Learn more →
              </span>
            </Link>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
