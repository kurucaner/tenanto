const ITEMS = [
  "Properties",
  "Units",
  "Leases",
  "Reservations",
  "Income",
  "Expenses",
  "Reports",
  "Team Access",
] as const;

export function Marquee() {
  const row = [...ITEMS, ...ITEMS];
  return (
    <section className="relative overflow-hidden border-y border-mist/8 bg-ink-2 py-6">
      <div className="animate-marquee flex w-max will-change-transform">
        {row.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="mx-6 flex items-center gap-6 font-display text-lg whitespace-nowrap text-mist/40"
          >
            {item}
            <span className="text-ember">✦</span>
          </span>
        ))}
      </div>
    </section>
  );
}
