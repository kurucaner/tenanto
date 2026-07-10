import Link from "next/link";

import { APP_NAME } from "@/packages/shared";

const FEATURES = [
  "Manage properties and units",
  "Track leases and reservations",
  "Record income and expenses",
  "Invite team members with role-based access",
  "View per-property financial reports",
] as const;

export function AppPurposeSection() {
  return (
    <section className="relative border-y border-mist/8 bg-ink-2/50 py-16 md:py-20" id="about">
      <div className="mx-auto max-w-3xl px-6">
        <h2 className="font-display text-2xl font-bold tracking-tight text-mist md:text-3xl">
          What is {APP_NAME}?
        </h2>
        <p className="mt-6 text-base leading-relaxed text-mist/70 md:text-lg">
          {APP_NAME} is a property management and accounting platform for short-term and long-term
          rental operators. It helps you run day-to-day property operations and understand portfolio
          performance in one admin platform.
        </p>
        <p className="mt-4 text-base leading-relaxed text-mist/70 md:text-lg">
          With {APP_NAME}, you can:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-6 text-base text-mist/70 md:text-lg">
          {FEATURES.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
        <p className="mt-6 text-base leading-relaxed text-mist/70 md:text-lg">
          Sign in with Google or email to access your account. We use your Google account
          information (name and email) only to authenticate you and manage your {APP_NAME}{" "}
          account.
        </p>
        <p className="mt-6 text-sm text-mist/50">
          <Link className="text-ember transition-colors hover:text-mist" href="/privacy-policy">
            Privacy Policy
          </Link>
          <span className="mx-2 text-mist/30">·</span>
          <Link className="text-ember transition-colors hover:text-mist" href="/terms-of-service">
            Terms of Service
          </Link>
        </p>
      </div>
    </section>
  );
}
