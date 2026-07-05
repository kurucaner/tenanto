import { Lock, Shield } from "lucide-react";

import { SecondaryPageLayout } from "@/components/secondary-page-layout";
import { APP_NAME, SUPPORT_EMAIL } from "@/packages/shared";

export const metadata = {
  title: `Security & Trust | ${APP_NAME}`,
  description: "4096-bit RSA encryption. No human access to keys. No AI training. Sovereign data.",
};

export default function SecurityPage() {
  return (
    <SecondaryPageLayout>
      <div className="mx-auto max-w-3xl">
        <div className="mb-16 flex items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full border border-[var(--gold)]/30 bg-[var(--gold)]/10">
            <Shield className="size-7 text-[var(--gold)]" />
          </div>
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-4xl font-medium text-foreground md:text-5xl">
              Your Data. Your Sovereignty.
            </h1>
            <p className="mt-2 text-lg text-foreground/60">
              Military-grade encryption. No human access to your vault content. Ever.
            </p>
          </div>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-12 text-foreground/80">
          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
              How We Protect Your Vault
            </h2>
            <p className="leading-relaxed">
              {APP_NAME} stores your vault content in secure cloud storage. We do not have access to
              view or decrypt your vault content. Here is how it works.
            </p>
            <ul className="mt-4 space-y-3">
              <li className="flex gap-3">
                <Lock className="mt-0.5 size-5 shrink-0 text-[var(--gold)]" />
                <span>
                  <strong className="text-foreground">4096-bit RSA encryption.</strong> All vault
                  content is encrypted with industry-standard keys. Your data is protected at rest
                  and in transit.
                </span>
              </li>
              <li className="flex gap-3">
                <Lock className="mt-0.5 size-5 shrink-0 text-[var(--gold)]" />
                <span>
                  <strong className="text-foreground">No human access.</strong> Encryption keys are
                  stored and managed in a way that prevents any human access. Only our automated
                  systems can operate on the stored data as needed to deliver the service.
                </span>
              </li>
              <li className="flex gap-3">
                <Lock className="mt-0.5 size-5 shrink-0 text-[var(--gold)]" />
                <span>
                  <strong className="text-foreground">We cannot read your vault.</strong> No one at
                  {APP_NAME} can view or decrypt your vault content. Our systems handle storage and
                  delivery only.
                </span>
              </li>
            </ul>
          </section>

          <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-6 backdrop-blur-sm">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-medium text-[var(--gold)]">
              Sovereign Data
            </h2>
            <p className="mt-2 leading-relaxed text-foreground/70">
              Explicit guarantees. No fine print.
            </p>
            <ul className="mt-6 space-y-4">
              <li>
                <strong className="text-foreground">Never used for AI training.</strong> Your vault
                content is never used to train AI models. Ever.
              </li>
              <li>
                <strong className="text-foreground">Never shared for advertising.</strong> We do not
                sell, rent, or share your data with advertisers or data brokers.
              </li>
              <li>
                <strong className="text-foreground">Never scanned for insights.</strong> We do not
                analyze your content for marketing, profiling, or any purpose other than delivering
                your legacy to your keyholders.
              </li>
              <li>
                <strong className="text-foreground">You own it.</strong> Delete your account and
                your data is removed. No lingering copies for &quot;improvement&quot; or
                &quot;research.&quot;
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
              Encryption Details
            </h2>
            <p className="leading-relaxed">Aligned with our Terms of Use and Privacy Policy.</p>
            <ul className="mt-4 space-y-2">
              <li>
                <strong className="text-[var(--gold)]">4096-bit RSA encryption</strong> for vault
                content
              </li>
              <li>
                <strong className="text-[var(--gold)]">Keys managed to prevent human access</strong>{" "}
                — stored and operated only by automated systems
              </li>
              <li>
                <strong className="text-[var(--gold)]">Secure cloud storage</strong> (AWS S3,
                encrypted at rest) for service operations
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
              Transparency: What We Can and Cannot Access
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-[var(--border-subtle)] p-4">
                <h3 className="text-sm font-medium uppercase tracking-wider text-[var(--gold)]">
                  We can access
                </h3>
                <ul className="mt-2 space-y-1 text-sm text-foreground/70">
                  <li>Account email</li>
                  <li>Vault metadata (names, schedules)</li>
                  <li>Keyholder emails</li>
                  <li>Storage usage</li>
                </ul>
              </div>
              <div className="rounded-lg border border-[var(--gold)]/30 bg-[var(--gold)]/5 p-4">
                <h3 className="text-sm font-medium uppercase tracking-wider text-[var(--gold)]">
                  No human access
                </h3>
                <ul className="mt-2 space-y-1 text-sm text-foreground/90">
                  <li>Vault content (view or decrypt)</li>
                  <li>Your passcode</li>
                  <li>Encryption keys (human access prevented)</li>
                  <li>File contents</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="border-t border-[var(--border-subtle)] pt-8">
            <p className="text-center text-xl font-medium tracking-wide text-foreground">
              No AI. No Ads. No Compromise.
            </p>
            <p className="mt-2 text-center text-sm text-foreground/50">
              Questions?{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[var(--gold)] hover:underline">
                {SUPPORT_EMAIL}
              </a>
            </p>
          </section>
        </div>
      </div>
    </SecondaryPageLayout>
  );
}
