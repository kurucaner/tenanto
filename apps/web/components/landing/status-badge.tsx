type StatusBadgeProps = Readonly<{
  variant: "coming-soon" | "shipped";
}>;

export function StatusBadge({ variant }: StatusBadgeProps) {
  if (variant === "shipped") {
    return (
      <span className="inline-flex rounded-full border border-mint/30 bg-mint/10 px-3 py-1 text-[10px] font-medium tracking-widest text-mint uppercase">
        Shipped
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-glow/30 bg-glow/10 px-3 py-1 text-[10px] font-medium tracking-widest text-glow uppercase">
      Coming soon
    </span>
  );
}
