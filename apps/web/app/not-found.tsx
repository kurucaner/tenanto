import Link from "next/link";

import { MarketingLayout } from "@/components/landing/marketing-layout";

export default function NotFound() {
  return (
    <MarketingLayout>
      <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-24 text-center">
        <p className="text-ember text-xs font-medium tracking-[0.3em] uppercase">404</p>
        <h1 className="mt-4 font-display text-4xl font-bold md:text-6xl">Page not found</h1>
        <p className="mt-4 max-w-md text-mist/60">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <Link
          className="mt-10 rounded-full bg-mist px-8 py-4 font-display text-ink text-sm font-semibold transition-transform hover:scale-105"
          href="/"
        >
          Back to home
        </Link>
      </main>
    </MarketingLayout>
  );
}
