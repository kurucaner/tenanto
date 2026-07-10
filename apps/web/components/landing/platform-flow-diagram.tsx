import { Reveal } from "@/components/landing/reveal";

const FLOW_STEPS = [
  { label: "Property", tone: "border-ember/30 bg-ember/10 text-ember" },
  { label: "Units (STR / LTR)", tone: "border-glow/30 bg-glow/10 text-glow" },
  { label: "Income + Expenses", tone: "border-mint/30 bg-mint/10 text-mint" },
  { label: "Reports", tone: "border-ember/30 bg-ember/10 text-ember" },
  { label: "Portfolio", tone: "border-glow/30 bg-glow/10 text-glow" },
] as const;

export function PlatformFlowDiagram() {
  return (
    <Reveal>
      <div className="glass flex flex-wrap items-center justify-center gap-3 rounded-2xl p-8 md:gap-4">
        {FLOW_STEPS.map((step, index) => (
          <div className="flex items-center gap-3 md:gap-4" key={step.label}>
            <span
              className={`rounded-full border px-4 py-2 font-display text-sm font-semibold ${step.tone}`}
            >
              {step.label}
            </span>
            {index < FLOW_STEPS.length - 1 ? (
              <span aria-hidden className="text-mist/30">
                →
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </Reveal>
  );
}
