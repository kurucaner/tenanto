import { BookOpen, FileKey, Fingerprint, RadioTower } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SecondaryPageLayout } from "@/components/secondary-page-layout";
import { APP_NAME, SUPPORT_EMAIL } from "@/packages/shared";

export const metadata: Metadata = {
  title: `Technical overview | ${APP_NAME}`,
  description: `Threat model, encryption posture, heartbeat-triggered release, and metadata practices for ${APP_NAME}.`,
};

const SECTION_IDS = [
  { id: "overview", label: "Overview" },
  { id: "threat-model", label: "Threat model" },
  { id: "cryptography", label: "Cryptography" },
  { id: "heartbeat", label: "Heartbeat & release" },
  { id: "metadata", label: "Metadata" },
  { id: "legal", label: "Legal process" },
  { id: "personas", label: "Persona lenses" },
  { id: "history", label: "Document history" },
] as const;

export default function WhitepaperPage() {
  return (
    <SecondaryPageLayout>
      <article className="mx-auto max-w-3xl lg:max-w-[min(100%,52rem)]">
        <header className="mb-14 grid gap-10 lg:grid-cols-[1fr_auto] lg:items-start lg:gap-16">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full border border-[var(--gold)]/30 bg-[var(--gold)]/10">
              <BookOpen className="size-7 text-[var(--gold)]" aria-hidden />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.38em] text-[var(--gold)]">
                Technical overview
              </p>
              <h1 className="mt-3 font-[family-name:var(--font-display)] text-[2.25rem] font-medium leading-[1.1] tracking-tight text-foreground md:text-5xl">
                How {APP_NAME} holds secrets you still control.
              </h1>
              <p className="mt-4 max-w-[60ch] text-base leading-relaxed text-[var(--text-muted)] md:text-lg">
                This page is the canonical web summary of our architecture and trust boundaries. It
                pairs with the{" "}
                <Link
                  href="/security"
                  className="text-[var(--gold)] underline-offset-4 hover:underline"
                >
                  security overview
                </Link>{" "}
                and the{" "}
                <Link
                  href="/canary"
                  className="text-[var(--gold)] underline-offset-4 hover:underline"
                >
                  warrant canary
                </Link>
                .
              </p>
            </div>
          </div>

          <nav
            aria-label="On this page"
            className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-6 backdrop-blur-sm lg:sticky lg:top-28 lg:min-w-[220px]"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-foreground/45">
              On this page
            </p>
            <ol className="mt-4 space-y-2.5 text-sm">
              {SECTION_IDS.map((s, i) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="group inline-flex items-baseline gap-2 text-foreground/60 transition-colors hover:text-[var(--gold)]"
                  >
                    <span className="font-mono text-[11px] tabular-nums text-[var(--gold)]/70">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="border-b border-transparent group-hover:border-[var(--gold)]/40">
                      {s.label}
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </header>

        <div className="prose prose-neutral max-w-none dark:prose-invert prose-headings:font-[family-name:var(--font-display)] prose-headings:font-medium prose-p:text-foreground/80 prose-li:text-foreground/80 prose-strong:text-foreground">
          <section
            id="overview"
            className="scroll-mt-28 border-t border-[var(--border-subtle-2)] pt-12"
          >
            <h2 className="text-2xl text-foreground">Overview</h2>
            <p className="leading-relaxed">
              {APP_NAME} is a vault for encrypted messages and files, combined with a check-in
              (“heartbeat”) workflow that can authorize delivery to people you name when you stop
              responding under rules you define. The product goal is continuity without daily
              password sharing: you pre-compose, pre-encrypt, and pre-authorize release.
            </p>
          </section>

          <section
            id="threat-model"
            className="scroll-mt-28 border-t border-[var(--border-subtle-2)] pt-12"
          >
            <h2 className="flex items-center gap-3 text-2xl text-foreground">
              <Fingerprint className="size-6 shrink-0 text-[var(--gold)]" aria-hidden />
              Threat model
            </h2>
            <p className="leading-relaxed">
              We design around a few grounded scenarios: loss of access while traveling, sudden
              incapacity, coercion or device compromise, and inheritance of digital access without
              custodial key recovery. The app assumes the user is the ultimate authority over who
              receives material and when silence counts as intent to release.
            </p>
            <p className="leading-relaxed">
              {APP_NAME} does not try to solve every adversary. It reduces single-point failure for
              pre-authorized, encrypted instructions when you cannot complete check-ins.
            </p>
          </section>

          <section
            id="cryptography"
            className="scroll-mt-28 border-t border-[var(--border-subtle-2)] pt-12"
          >
            <h2 className="flex items-center gap-3 text-2xl text-foreground">
              <FileKey className="size-6 shrink-0 text-[var(--gold)]" aria-hidden />
              Cryptography &amp; zero-knowledge posture
            </h2>
            <p className="leading-relaxed">
              Vault content is protected with strong, industry-standard encryption. As described in
              our{" "}
              <Link href="/security" className="text-[var(--gold)] no-underline hover:underline">
                security page
              </Link>
              , we do not have human-readable access to vault plaintext; automated systems operate
              storage and delivery only. You should treat “zero-knowledge” in the practical sense:
              we cannot read your vault content, and keys are handled so that routine operations do
              not expose plaintext to staff.
            </p>
            <ul className="mt-4 space-y-3">
              <li className="leading-relaxed">
                <strong className="text-foreground">Client-side intent.</strong> Composition and
                encryption happen in your environment; the server stores ciphertext and enforces
                account rules.
              </li>
              <li className="leading-relaxed">
                <strong className="text-foreground">Verify and export.</strong> Skeptics should use
                in-app flows (where available) to inspect ciphertext handling and backup
                discipline—pair with your own device hygiene.
              </li>
            </ul>
          </section>

          <section
            id="heartbeat"
            className="scroll-mt-28 border-t border-[var(--border-subtle-2)] pt-12"
          >
            <h2 className="flex items-center gap-3 text-2xl text-foreground">
              <RadioTower className="size-6 shrink-0 text-[var(--gold)]" aria-hidden />
              Heartbeat &amp; release
            </h2>
            <p className="leading-relaxed">
              Check-ins prove liveness on a cadence you choose. If check-ins lapse past thresholds
              you set, the service can progress a release workflow to recipients you defined ahead
              of time. Timing, escalation, and notifications are product-controlled; the important
              trust claim is that release is gated on your policy, not on ad-hoc access by
              operators.
            </p>
            <p className="leading-relaxed">
              Heartbeat proves activity—not moral intent, not freedom from coercion, and not perfect
              security on a compromised device. Pair the feature with your own operational security.
            </p>
          </section>

          <section
            id="metadata"
            className="scroll-mt-28 border-t border-[var(--border-subtle-2)] pt-12"
          >
            <h2 className="text-2xl text-foreground">Metadata &amp; logging</h2>
            <p className="leading-relaxed">
              Some metadata necessarily exists to run accounts: authentication identifiers, device
              and app version signals, notification tokens, and operational logs for reliability and
              abuse prevention. Our{" "}
              <Link href="/privacy" className="text-[var(--gold)] no-underline hover:underline">
                privacy policy
              </Link>{" "}
              lists categories at a high level. We minimize what we collect and retain, and we do
              not use vault content to train models or for advertising.
            </p>
          </section>

          <section
            id="legal"
            className="scroll-mt-28 border-t border-[var(--border-subtle-2)] pt-12"
          >
            <h2 className="text-2xl text-foreground">Legal process</h2>
            <p className="leading-relaxed">
              We maintain a warrant canary as a transparency signal. It states, in plain language,
              whether we have received certain classes of compelled requests. It does not replace
              counsel, and it cannot disclose requests we are legally barred from mentioning—hence
              the narrow, structured wording on the{" "}
              <Link href="/canary" className="text-[var(--gold)] no-underline hover:underline">
                canary page
              </Link>
              .
            </p>
          </section>

          <section
            id="personas"
            className="scroll-mt-28 border-t border-[var(--border-subtle-2)] pt-12"
          >
            <h2 className="text-2xl text-foreground">Persona lenses</h2>
            <p className="leading-relaxed">
              The same vault behaves differently in how you explain it. We publish focused landing
              paths for{" "}
              <Link href="/travel" className="text-[var(--gold)] no-underline hover:underline">
                travel
              </Link>
              ,{" "}
              <Link href="/crypto" className="text-[var(--gold)] no-underline hover:underline">
                crypto access planning
              </Link>
              ,{" "}
              <Link href="/journalists" className="text-[var(--gold)] no-underline hover:underline">
                high-risk roles
              </Link>
              , and{" "}
              <Link href="/family" className="text-[var(--gold)] no-underline hover:underline">
                family continuity
              </Link>
              . Threat emphasis changes; the cryptographic posture does not.
            </p>
          </section>

          <section
            id="history"
            className="scroll-mt-28 border-t border-[var(--border-subtle-2)] pb-8 pt-12"
          >
            <h2 className="text-2xl text-foreground">Document history</h2>
            <p className="leading-relaxed">
              <strong className="text-foreground">Version 1.0</strong> — April 2026. Initial web
              publication of this overview.
            </p>
            <p className="mt-6 text-sm leading-relaxed text-[var(--text-muted)]">
              For corrections, press, or a printable bundle, email{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[var(--gold)] hover:underline">
                {SUPPORT_EMAIL}
              </a>
              {"."}
            </p>
          </section>
        </div>
      </article>
    </SecondaryPageLayout>
  );
}
