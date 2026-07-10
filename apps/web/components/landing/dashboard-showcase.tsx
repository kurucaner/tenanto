"use client";

import { motion, useScroll, useSpring, useTransform } from "motion/react";
import { useRef } from "react";

import { DashboardMock } from "@/components/landing/dashboard-mock";
import { Reveal } from "@/components/landing/reveal";
import { MOCK_PORTFOLIO } from "@/lib/marketing-mocks";

/** Pinned section: dashboard tilts up from the horizon and locks into place. */
export function DashboardShowcase() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    offset: ["start end", "end end"],
    target: ref,
  });
  const smooth = useSpring(scrollYProgress, { damping: 24, stiffness: 90 });

  const rotateX = useTransform(smooth, [0, 0.7], [38, 0]);
  const scale = useTransform(smooth, [0, 0.7], [0.82, 1]);
  const y = useTransform(smooth, [0, 0.7], [140, 0]);
  const opacity = useTransform(smooth, [0, 0.35], [0, 1]);

  return (
    <section className="relative py-32 md:py-44" id="platform" ref={ref}>
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="text-center">
          <p className="mb-4 text-ember text-xs font-medium tracking-[0.3em] uppercase">
            The platform
          </p>
          <h2 className="font-display text-4xl font-bold tracking-tight md:text-6xl">
            Your entire portfolio,
            <br />
            <span className="text-stroke">on one screen.</span>
          </h2>
        </Reveal>

        <div className="mt-16 [perspective:1400px]">
          <motion.div
            className="will-change-transform [transform-style:preserve-3d]"
            style={{ opacity, rotateX, scale, y }}
          >
            <DashboardMock {...MOCK_PORTFOLIO} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
