"use client";

import { motion, useScroll, useSpring,useTransform } from "motion/react";
import { useRef } from "react";

import { Reveal } from "@/components/landing/reveal";
import { APP_SLUG } from "@/packages/shared";

const BARS = [42, 68, 55, 80, 62, 92, 74, 98]

function DashboardMock() {
  return (
    <div className="glass overflow-hidden rounded-2xl shadow-[0_40px_120px_-20px_rgba(124,140,255,0.35)]">
      {/* window chrome */}
      <div className="flex items-center gap-2 border-b border-mist/8 px-5 py-3.5">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="ml-4 font-display text-xs text-mist/40">
          {APP_SLUG}.app — Portfolio Overview
        </span>
      </div>

      <div className="grid grid-cols-[180px_1fr] max-md:grid-cols-1">
        {/* sidebar */}
        <div className="hidden flex-col gap-1 border-r border-mist/8 p-4 md:flex">
          {['Overview', 'Residents', 'Leases', 'Maintenance', 'Payments', 'Reports'].map(
            (item, i) => (
              <span
                key={item}
                className={`rounded-lg px-3 py-2 text-xs ${
                  i === 0 ? 'bg-ember/15 text-ember' : 'text-mist/50'
                }`}
              >
                {item}
              </span>
            ),
          )}
        </div>

        {/* main panel */}
        <div className="p-5">
          <div className="mb-5 grid grid-cols-3 gap-3">
            {[
              { label: 'Occupancy', value: '97.2%', tone: 'text-mint' },
              { label: 'Open tickets', value: '12', tone: 'text-ember' },
              { label: 'Collected MTD', value: '$1.84M', tone: 'text-glow' },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl bg-mist/4 p-4">
                <p className="text-[10px] tracking-widest uppercase text-mist/40">
                  {kpi.label}
                </p>
                <p className={`mt-1 font-display text-xl font-bold ${kpi.tone}`}>
                  {kpi.value}
                </p>
              </div>
            ))}
          </div>

          {/* animated revenue bars */}
          <div className="rounded-xl bg-mist/4 p-4">
            <p className="mb-4 text-[10px] tracking-widest uppercase text-mist/40">
              Rent collection — last 8 months
            </p>
            <div className="flex h-32 items-end gap-2.5">
              {BARS.map((h, i) => (
                <motion.div
                  key={i}
                  initial={{ scaleY: 0 }}
                  whileInView={{ scaleY: 1 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{
                    duration: 0.9,
                    delay: 0.15 + i * 0.08,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  style={{ height: `${h}%` }}
                  className="flex-1 origin-bottom rounded-t-md bg-gradient-to-t from-glow/40 to-ember will-change-transform"
                />
              ))}
            </div>
          </div>

          {/* live feed rows */}
          <div className="mt-4 space-y-2">
            {[
              ['🔧', 'Unit 4B — HVAC ticket auto-assigned to CoolAir Co.', 'just now'],
              ['✅', 'Lease renewal signed — Tower West, Unit 1207', '2m ago'],
              ['💸', 'Rent batch settled — $214,800 across 96 units', '9m ago'],
            ].map(([icon, text, time], i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.5 + i * 0.15 }}
                className="flex items-center justify-between rounded-lg bg-mist/4 px-4 py-2.5 text-xs"
              >
                <span className="text-mist/70">
                  <span className="mr-2">{icon}</span>
                  {text}
                </span>
                <span className="text-mist/30 max-sm:hidden">{time}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Pinned section: dashboard tilts up from the horizon and locks into place. */
export function DashboardShowcase() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end end'],
  })
  const smooth = useSpring(scrollYProgress, { stiffness: 90, damping: 24 })

  const rotateX = useTransform(smooth, [0, 0.7], [38, 0])
  const scale = useTransform(smooth, [0, 0.7], [0.82, 1])
  const y = useTransform(smooth, [0, 0.7], [140, 0])
  const opacity = useTransform(smooth, [0, 0.35], [0, 1])

  return (
    <section id="platform" ref={ref} className="relative py-32 md:py-44">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="text-center">
          <p className="mb-4 text-xs font-medium tracking-[0.3em] uppercase text-ember">
            The platform
          </p>
          <h2 className="font-display text-4xl font-bold tracking-tight md:text-6xl">
            Your entire portfolio,
            <br />
            <span className="text-stroke">alive on one screen.</span>
          </h2>
        </Reveal>

        <div className="mt-16 [perspective:1400px]">
          <motion.div
            style={{ rotateX, scale, y, opacity }}
            className="will-change-transform [transform-style:preserve-3d]"
          >
            <DashboardMock />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
