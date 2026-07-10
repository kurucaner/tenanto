"use client";

import Link from "next/link";

import { BreadcrumbNav } from "@/components/landing/breadcrumb-nav";
import { CTABanner } from "@/components/landing/cta-banner";
import { MarketingLayout } from "@/components/landing/marketing-layout";
import { PageHero } from "@/components/landing/page-hero";
import { Reveal } from "@/components/landing/reveal";
import { SectionHeader } from "@/components/landing/section-header";
import { APP_NAME, SUPPORT_EMAIL } from "@/packages/shared";

export function SecurityPageContent() {
  return (
    <MarketingLayout showAurora>
      <main>
        <BreadcrumbNav current="Security" />
        <PageHero
          eyebrow="Security"
          headline="Secure by design."
          headlineAccent="Transparent by default."
          subhead={`${APP_NAME} protects operator data with industry-standard authentication, role-based access, and encrypted transport.`}
        />

        <div className="space-y-24 pb-24 md:space-y-32">
          <section>
            <div className="mx-auto max-w-6xl space-y-10 px-6">
              <SectionHeader
                body="JWT access and refresh tokens with Google and Apple sign-in. Refresh tokens are hashed and stored securely server-side."
                eyebrow="Authentication"
                title="Modern auth, no shortcuts"
              />
            </div>
          </section>

          <section>
            <div className="mx-auto max-w-6xl px-6">
              <Reveal>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="glass rounded-2xl p-8">
                    <h3 className="font-display text-lg font-semibold">Role-based access</h3>
                    <p className="mt-3 text-mist/60 text-sm leading-relaxed">
                      Property data is visible only to members you authorize. Owners, managers, and
                      accountants each get scoped permissions per property workspace.
                    </p>
                  </div>
                  <div className="glass rounded-2xl p-8">
                    <h3 className="font-display text-lg font-semibold">Transport & headers</h3>
                    <p className="mt-3 text-mist/60 text-sm leading-relaxed">
                      HTTPS everywhere, rate limiting on API routes, and security headers via Helmet
                      on the server.
                    </p>
                  </div>
                  <div className="glass rounded-2xl p-8">
                    <h3 className="font-display text-lg font-semibold">Support attachments</h3>
                    <p className="mt-3 text-mist/60 text-sm leading-relaxed">
                      Image uploads use presigned S3 URLs — files go directly to storage without
                      passing through application logs.
                    </p>
                  </div>
                  <div className="glass rounded-2xl p-8">
                    <h3 className="font-display text-lg font-semibold">Account deletion</h3>
                    <p className="mt-3 text-mist/60 text-sm leading-relaxed">
                      Delete your account from settings or request help via support. See our{" "}
                      <Link className="text-ember hover:text-mist" href="/delete-account">
                        deletion guide
                      </Link>
                      .
                    </p>
                  </div>
                </div>
              </Reveal>
            </div>
          </section>

          <section>
            <div className="mx-auto max-w-3xl px-6 text-center">
              <p className="text-mist/60 text-sm">
                Read our{" "}
                <Link className="text-ember hover:text-mist" href="/privacy-policy">
                  Privacy Policy
                </Link>{" "}
                for full details. Questions?{" "}
                <a className="text-ember hover:text-mist" href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>
              </p>
            </div>
          </section>
        </div>

        <CTABanner />
      </main>
    </MarketingLayout>
  );
}

export function ContactPageContent() {
  return (
    <MarketingLayout showAurora>
      <main>
        <BreadcrumbNav current="Contact" />
        <PageHero
          eyebrow="Contact"
          headline="Book a demo or"
          headlineAccent="start your pilot."
          primaryCta={{ href: `mailto:${SUPPORT_EMAIL}`, label: "Email us" }}
          secondaryCta={{ href: "/pricing", label: "See pricing" }}
          subhead="Tell us about your portfolio. We typically respond within 24–48 hours."
        />

        <section className="pb-24">
          <div className="mx-auto max-w-xl px-6">
            <Reveal>
              <div className="glass space-y-8 rounded-2xl p-8">
                <div>
                  <h2 className="font-display text-ember text-lg font-semibold">Pilot & demos</h2>
                  <a
                    className="mt-2 block text-mist/80 transition-colors hover:text-mist"
                    href={`mailto:${SUPPORT_EMAIL}`}
                  >
                    {SUPPORT_EMAIL}
                  </a>
                </div>
                <div>
                  <h2 className="font-display text-ember text-lg font-semibold">
                    Existing customers
                  </h2>
                  <p className="mt-2 text-mist/60 text-sm">
                    Open Support from the {APP_NAME} admin app for in-app tickets with attachments.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <CTABanner />
      </main>
    </MarketingLayout>
  );
}
