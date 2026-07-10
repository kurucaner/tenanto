"use client";

import { animate, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { Reveal } from "@/components/landing/reveal";

type KpiItem = {
  label: string;
  suffix: string;
  value: number;
};

type KpiStripProps = Readonly<{
  items: readonly KpiItem[];
}>;

function Counter({ label, suffix, value }: KpiItem) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { margin: "-60px", once: true });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, {
      duration: 2.2,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v).toLocaleString("en-US")),
    });
    return () => controls.stop();
  }, [inView, value]);

  return (
    <Reveal className="text-center">
      <p className="font-display text-4xl font-bold tracking-tight md:text-5xl">
        <span className="tabular-nums" ref={ref}>
          {display}
        </span>
        <span className="text-ember">{suffix}</span>
      </p>
      <p className="mt-3 text-mist/50 text-sm">{label}</p>
    </Reveal>
  );
}

export function KpiStrip({ items }: KpiStripProps) {
  return (
    <section className="border-y border-mist/8 bg-ink-2 py-24 md:py-32">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-8 gap-y-14 px-6 lg:grid-cols-4">
        {items.map((item) => (
          <Counter key={item.label} {...item} />
        ))}
      </div>
    </section>
  );
}
