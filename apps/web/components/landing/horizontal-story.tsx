"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";

const PANELS = [
  {
    accent: "from-ember/25",
    body: "Add properties and units, then invite owners, managers, and accountants with role-based access.",
    icon: "🏠",
    kicker: "01 — Portfolio",
    title: "Organize every property in one workspace.",
  },
  {
    accent: "from-glow/25",
    body: "Track leases and reservations alongside the income and expenses tied to each unit.",
    icon: "📋",
    kicker: "02 — Operations",
    title: "Record leases, reservations, and revenue.",
  },
  {
    accent: "from-mint/25",
    body: "Capture operating costs and extra income lines with the tax and commission context you need.",
    icon: "💳",
    kicker: "03 — Accounting",
    title: "Keep property finances in one ledger.",
  },
  {
    accent: "from-ember/25",
    body: "Review per-property and portfolio reports to understand performance across your rentals.",
    icon: "📊",
    kicker: "04 — Reporting",
    title: "See portfolio performance clearly.",
  },
] as const;

/** Vertical scroll drives a cinematic horizontal pan across four story panels. */
export function HorizontalStory() {
  const sectionRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [distance, setDistance] = useState(0)

  useLayoutEffect(() => {
    const measure = () => {
      if (trackRef.current) {
        setDistance(trackRef.current.scrollWidth - window.innerWidth)
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const { scrollYProgress } = useScroll({ target: sectionRef })
  const x = useTransform(scrollYProgress, [0, 1], [0, -distance])

  return (
    <section id="features" ref={sectionRef} className="relative h-[380vh]">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <motion.div
          ref={trackRef}
          style={{ x }}
          className="flex gap-8 pl-[8vw] pr-[10vw] will-change-transform"
        >
          <div className="flex w-[42vw] min-w-[320px] shrink-0 flex-col justify-center">
            <p className="mb-4 text-xs font-medium tracking-[0.3em] uppercase text-ember">
              How it works
            </p>
            <h2 className="font-display text-4xl font-bold tracking-tight md:text-6xl">
              Four rooms.
              <br />
              One key.
            </h2>
            <p className="mt-6 max-w-sm text-mist/50">
              Keep scrolling — the story moves sideways from here.
            </p>
          </div>

          {PANELS.map((p) => (
            <article
              key={p.kicker}
              className={`group relative flex h-[68vh] w-[58vw] min-w-[420px] max-w-[720px] shrink-0 flex-col justify-end overflow-hidden rounded-3xl border border-mist/10 bg-gradient-to-br ${p.accent} to-ink-2 p-10 transition-transform duration-500 hover:scale-[1.015]`}
            >
              <span className="absolute top-10 left-10 text-5xl opacity-80 transition-transform duration-500 group-hover:scale-125 group-hover:rotate-6">
                {p.icon}
              </span>
              <span className="absolute -right-6 -top-10 font-display text-[11rem] font-bold text-mist/5 select-none">
                {p.kicker.slice(0, 2)}
              </span>
              <p className="mb-3 text-xs font-medium tracking-[0.3em] uppercase text-mist/50">
                {p.kicker}
              </p>
              <h3 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
                {p.title}
              </h3>
              <p className="mt-4 max-w-md text-mist/60">{p.body}</p>
            </article>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
