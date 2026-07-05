import Link from "next/link";

import { SecondaryPageLayout } from "@/components/secondary-page-layout";
import { APP_NAME } from "@/packages/shared";

export const metadata = {
  title: `Page Not Found | ${APP_NAME}`,
  description: "The page you're looking for doesn't exist or has been moved.",
};

export default function NotFound() {
  return (
    <SecondaryPageLayout>
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="mb-4 font-[family-name:var(--font-display)] text-6xl font-medium text-foreground md:text-8xl">
          404
        </h1>
        <p className="mb-8 text-lg text-foreground/60">
          This page doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-[var(--gold)]/30 bg-[var(--gold)]/10 px-6 py-3 text-sm font-medium uppercase tracking-widest text-[var(--gold)] transition-colors hover:bg-[var(--gold)]/20"
        >
          Back to Home
        </Link>
      </div>
    </SecondaryPageLayout>
  );
}
