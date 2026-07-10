import { Reveal } from "@/components/landing/reveal";

type SectionHeaderProps = Readonly<{
  align?: "center" | "left";
  body?: string;
  className?: string;
  eyebrow: string;
  title: string;
}>;

export function SectionHeader({
  align = "left",
  body,
  className,
  eyebrow,
  title,
}: SectionHeaderProps) {
  const alignClass = align === "center" ? "text-center mx-auto" : "";

  return (
    <Reveal className={`max-w-3xl ${alignClass} ${className ?? ""}`}>
      <p className="mb-4 text-ember text-xs font-medium tracking-[0.3em] uppercase">{eyebrow}</p>
      <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">{title}</h2>
      {body ? <p className="mt-5 text-base text-mist/55 md:text-lg">{body}</p> : null}
    </Reveal>
  );
}
