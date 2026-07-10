"use client";

import { motion } from "motion/react";

import { APP_SLUG } from "@/packages/shared";

export type TDashboardKpi = {
  label: string;
  tone: string;
  value: string;
};

export type TDashboardMockProps = Readonly<{
  activeSidebarIndex?: number;
  barsLabel?: string;
  feedRows?: readonly (readonly [string, string, string])[];
  kpis: readonly TDashboardKpi[];
  sidebarItems: readonly string[];
  title?: string;
}>;

const DEFAULT_BARS = [42, 68, 55, 80, 62, 92, 74, 98];

export function DashboardMock({
  activeSidebarIndex = 0,
  barsLabel = "Revenue trend — last 8 months",
  feedRows = [
    ["🏨", "Airbnb stay — Unit 2A, $1,240 gross", "just now"],
    ["🗝️", "Rent recorded — Unit 4B, March", "2m ago"],
    ["📊", "Portfolio report exported — CSV", "9m ago"],
  ],
  kpis,
  sidebarItems,
  title = "Portfolio Overview",
}: TDashboardMockProps) {
  return (
    <div className="glass overflow-hidden rounded-2xl shadow-[0_40px_120px_-20px_rgba(124,140,255,0.35)]">
      <div className="flex items-center gap-2 border-b border-mist/8 px-5 py-3.5">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="ml-4 font-display text-mist/40 text-xs">
          {APP_SLUG}.app — {title}
        </span>
      </div>

      <div className="grid max-md:grid-cols-1 md:grid-cols-[180px_1fr]">
        <div className="hidden flex-col gap-1 border-r border-mist/8 p-4 md:flex">
          {sidebarItems.map((item, i) => (
            <span
              className={`rounded-lg px-3 py-2 text-xs ${
                i === activeSidebarIndex ? "bg-ember/15 text-ember" : "text-mist/50"
              }`}
              key={item}
            >
              {item}
            </span>
          ))}
        </div>

        <div className="p-5">
          <div className="mb-5 grid grid-cols-3 gap-3">
            {kpis.map((kpi) => (
              <div className="rounded-xl bg-mist/4 p-4" key={kpi.label}>
                <p className="text-[10px] text-mist/40 tracking-widest uppercase">{kpi.label}</p>
                <p className={`mt-1 font-display text-xl font-bold ${kpi.tone}`}>{kpi.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-mist/4 p-4">
            <p className="mb-4 text-[10px] text-mist/40 tracking-widest uppercase">{barsLabel}</p>
            <div className="flex h-32 items-end gap-2.5">
              {DEFAULT_BARS.map((h, i) => (
                <motion.div
                  className="flex-1 origin-bottom rounded-t-md bg-gradient-to-t from-glow/40 to-ember will-change-transform"
                  initial={{ scaleY: 0 }}
                  key={i}
                  style={{ height: `${h}%` }}
                  transition={{
                    delay: 0.15 + i * 0.08,
                    duration: 0.9,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  viewport={{ margin: "-60px", once: true }}
                  whileInView={{ scaleY: 1 }}
                />
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {feedRows.map(([icon, text, time], i) => (
              <motion.div
                className="flex items-center justify-between rounded-lg bg-mist/4 px-4 py-2.5 text-xs"
                initial={{ opacity: 0, x: -24 }}
                key={text}
                transition={{ delay: 0.5 + i * 0.15, duration: 0.6 }}
                viewport={{ once: true }}
                whileInView={{ opacity: 1, x: 0 }}
              >
                <span className="text-mist/70">
                  <span className="mr-2">{icon}</span>
                  {text}
                </span>
                <span className="max-sm:hidden text-mist/30">{time}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
