import Link from "next/link";

import { CompliancePageLayout } from "@/components/landing/compliance-page-layout";
import { APP_NAME } from "@/packages/shared";

const FEATURES = [
  "Manage properties and units",
  "Track leases and reservations",
  "Record income and expenses",
  "Invite team members with role-based access",
  "View per-property financial reports",
] as const;

const GOOGLE_DATA_USES = [
  "Authenticate your account when you choose Sign in with Google",
  "Read your Google account email address to create and identify your user account",
  "Read your Google account name to display on your profile",
] as const;

export function ComplianceHomePage() {
  return (
    <CompliancePageLayout>
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
          {APP_NAME} — Property Management Application
        </h1>
        <p className="mt-6 text-base leading-relaxed text-mist md:text-lg">
          {APP_NAME} is a web application for rental property operators. This application helps you
          manage property operations and property accounting in one admin platform.
        </p>

        <h2 className="mt-10 font-display text-xl font-semibold md:text-2xl">Application purpose</h2>
        <p className="mt-4 text-base leading-relaxed text-mist md:text-lg">
          The purpose of {APP_NAME} is to help short-term and long-term rental operators track
          portfolio performance and day-to-day property operations. With {APP_NAME}, you can:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-6 text-base text-mist md:text-lg">
          {FEATURES.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>

        <h2 className="mt-10 font-display text-xl font-semibold md:text-2xl">
          How {APP_NAME} uses Google user data
        </h2>
        <p className="mt-4 text-base leading-relaxed text-mist md:text-lg">
          {APP_NAME} offers Sign in with Google for authentication. When you sign in with Google, we
          request access to basic profile information only. We use Google user data to:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-6 text-base text-mist md:text-lg">
          {GOOGLE_DATA_USES.map((use) => (
            <li key={use}>{use}</li>
          ))}
        </ul>
        <p className="mt-4 text-base leading-relaxed text-mist md:text-lg">
          We do not use Google user data for advertising. We do not sell Google user data. We do not
          access your Google contacts, calendar, Drive files, or other Google services. You can also
          sign in with email and password instead of Google.
        </p>

        <p className="mt-8 text-base text-mist">
          <Link className="font-medium text-ember underline-offset-4 hover:underline" href="/privacy-policy">
            Privacy Policy
          </Link>
          <span className="mx-2 text-mist/40">·</span>
          <Link className="font-medium text-ember underline-offset-4 hover:underline" href="/terms-of-service">
            Terms of Service
          </Link>
        </p>

        <p className="mt-6 text-sm text-mist/70">
          <Link className="text-ember underline-offset-4 hover:underline" href="/welcome">
            View product overview
          </Link>
        </p>
      </div>
    </CompliancePageLayout>
  );
}
