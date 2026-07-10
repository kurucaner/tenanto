"use client";

import { animate, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { Reveal } from "@/components/landing/reveal";
import { CAPABILITY_STATS } from "@/lib/marketing-content";

type Stat = {
  decimals?: number;
  label: string;
  suffix: string;
  value: number;
};

const STATS: Stat[] = CAPABILITY_STATS.map((stat) => ({
  label: stat.label,
  suffix: stat.suffix,
  value: stat.value,
}));

function Counter({ value, suffix, decimals = 0 }: Stat) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const [display, setDisplay] = useState('0')

  useEffect(() => {
    if (!inView) return
    const controls = animate(0, value, {
      duration: 2.2,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) =>
        setDisplay(
          v.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          }),
        ),
    })
    return () => controls.stop()
  }, [inView, value, decimals])

  return (
    <span ref={ref} className="tabular-nums">
      {display}
      <span className="text-ember">{suffix}</span>
    </span>
  )
}

export function Stats() {
  return (
    <section className="border-y border-mist/8 bg-ink-2 py-24 md:py-32">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-8 gap-y-14 px-6 lg:grid-cols-4">
        {STATS.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.1} className="text-center">
            <p className="font-display text-4xl font-bold tracking-tight md:text-5xl">
              <Counter {...s} />
            </p>
            <p className="mt-3 text-sm text-mist/50">{s.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
