"use client";

import { motion, useMotionValue, useSpring } from "motion/react";
import Link from "next/link";
import { type ReactNode, useRef } from "react";

import { Reveal } from "@/components/landing/reveal";
import { PILOT_TAGLINE } from "@/lib/marketing-content";

function MagneticLink({ children, href }: { children: ReactNode; href: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { damping: 16, stiffness: 200 });
  const sy = useSpring(y, { damping: 16, stiffness: 200 });

  const onMove = (e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set((e.clientX - rect.left - rect.width / 2) * 0.3);
    y.set((e.clientY - rect.top - rect.height / 2) * 0.3);
  };

  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.span onMouseLeave={onLeave} onMouseMove={onMove} style={{ x: sx, y: sy }}>
      <Link
        className="inline-block rounded-full bg-gradient-to-r from-ember to-glow px-12 py-6 font-display text-ink text-lg font-bold shadow-[0_20px_60px_-10px_rgba(255,107,61,0.5)] will-change-transform"
        href={href}
        ref={ref}
      >
        {children}
      </Link>
    </motion.span>
  );
}

type CTABannerProps = Readonly<{
  description?: string;
  headline?: string;
  headlineAccent?: string;
  id?: string;
}>;

export function CTABanner({
  description = "Onboard your first property in under an hour. No setup fees, no per-seat pricing — just calmer operations.",
  headline = "Ready to see your portfolio",
  headlineAccent = "in one place?",
  id,
}: CTABannerProps) {
  return (
    <section className="relative overflow-hidden py-36 md:py-48" id={id}>
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 h-[40rem] w-[40rem] -translate-x-1/2 -translate-y-1/2 animate-aurora rounded-full bg-glow/12 blur-[140px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 left-1/3 h-[28rem] w-[28rem] animate-aurora rounded-full bg-ember/10 blur-[120px] [animation-delay:-6s]"
      />

      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <Reveal>
          <h2 className="font-display text-4xl font-bold tracking-tight md:text-6xl">
            {headline}
            <br />
            <span className="bg-gradient-to-r from-ember via-[#ff9d6b] to-glow bg-clip-text text-transparent">
              {headlineAccent}
            </span>
          </h2>
        </Reveal>
        <Reveal delay={0.15}>
          <p className="mx-auto mt-8 max-w-xl text-lg text-mist/60">{description}</p>
        </Reveal>
        <Reveal className="mt-12" delay={0.3}>
          <MagneticLink href="/contact">Start your free pilot →</MagneticLink>
          <p className="mt-6 animate-pulse-soft text-mist/40 text-sm">
            {PILOT_TAGLINE} ·{" "}
            <Link className="text-mist/55 transition-colors hover:text-mist" href="/pricing">
              Pricing details
            </Link>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
