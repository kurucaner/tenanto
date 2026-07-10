import { SecondaryPageLayout } from "@/components/secondary-page-layout";
import { APP_NAME, SUPPORT_EMAIL } from "@/packages/shared";

export const metadata = {
  description: `Privacy Policy for ${APP_NAME} property management platform.`,
  title: `Privacy Policy | ${APP_NAME}`,
};

export default function PrivacyPolicyPage() {
  return (
    <SecondaryPageLayout>
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-12 font-[family-name:var(--font-display)] text-4xl font-medium text-foreground md:text-5xl">
          Privacy Policy
        </h1>
        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-foreground/80">
          <p className="leading-relaxed">
            Last updated: March 1, 2026. {APP_NAME} (&quot;we,&quot; &quot;us,&quot; or
            &quot;our&quot;) provides property management and accounting software for rental
            operators. This Privacy Policy describes how we collect, use, and protect information
            when you use our website, admin platform, and related services.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Information We Collect
          </h2>
          <p className="leading-relaxed">
            We collect account information (name, email, authentication provider identifiers),
            property and financial data you enter into the platform (properties, units, leases,
            reservations, income, expenses), usage metadata (browser type, app version, log data),
            and communications you send to support.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            How We Use Information
          </h2>
          <p className="leading-relaxed">
            We use your information to operate and improve {APP_NAME}, authenticate users, process
            property accounting, send transactional emails (invitations, verification codes, support
            replies), provide customer support, maintain security, and comply with legal obligations.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Sharing
          </h2>
          <p className="leading-relaxed">
            We share data with service providers that help us run the platform (cloud hosting,
            email delivery, authentication). We do not sell your personal information. Property data
            is visible only to members you authorize on each property workspace.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Security & Retention
          </h2>
          <p className="leading-relaxed">
            We use industry-standard safeguards to protect data in transit and at rest. We retain
            account and property data while your account is active. If you delete your account, we
            delete or anonymize personal data within a reasonable period, subject to legal retention
            requirements.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Your Rights
          </h2>
          <p className="leading-relaxed">
            Depending on your location, you may request access, correction, deletion, or export of
            your personal data. Contact{" "}
            <a className="text-[var(--gold)] hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>{" "}
            to exercise these rights.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Changes
          </h2>
          <p className="leading-relaxed">
            We may update this policy from time to time. Material changes will be posted on this
            page with an updated &quot;Last updated&quot; date. Continued use of {APP_NAME} after
            changes constitutes acceptance.
          </p>

          <p className="leading-relaxed">
            Questions? Email{" "}
            <a className="text-[var(--gold)] hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </div>
      </div>
    </SecondaryPageLayout>
  );
}
