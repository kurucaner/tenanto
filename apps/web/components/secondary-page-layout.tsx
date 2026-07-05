import { ArrowLeft } from "lucide-react";
import Link from "next/link";

type SecondaryPageLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export function SecondaryPageLayout({ children }: SecondaryPageLayoutProps) {
  return (
    <div className="relative min-h-screen pt-20">
      <div className="absolute inset-0 bg-hero-gradient" aria-hidden />
      <div className="relative px-6 py-16 md:px-12">
        <Link
          href="/"
          className="mb-12 inline-flex items-center gap-2 text-sm uppercase tracking-widest text-foreground/50 transition-colors hover:text-[var(--gold)]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Link>
        {children}
      </div>
    </div>
  );
}
