import { LegalProse } from "@/components/landing/legal-prose";
import { MarketingLayout } from "@/components/landing/marketing-layout";
import { pageMetadata } from "@/lib/marketing-content";
import { APP_NAME, SUPPORT_EMAIL } from "@/packages/shared";

export const metadata = pageMetadata(
  "Privacy Policy",
  `Privacy Policy for ${APP_NAME} property management platform.`,
);

export default function PrivacyPolicyPage() {
  return (
    <MarketingLayout>
      <LegalProse title="Privacy Policy">
        <p>
          Last updated: March 1, 2026. {APP_NAME} (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
          provides property management and accounting software for rental operators. This Privacy
          Policy describes how we collect, use, and protect information when you use our website,
          admin platform, and related services.
        </p>

        <h2>Information We Collect</h2>
        <p>
          We collect account information (name, email, authentication provider identifiers),
          property and financial data you enter into the platform (properties, units, leases,
          reservations, income, expenses), usage metadata (browser type, app version, log data), and
          communications you send to support.
        </p>

        <h2>How We Use Information</h2>
        <p>
          We use your information to operate and improve {APP_NAME}, authenticate users, process
          property accounting, send transactional emails (invitations, verification codes, support
          replies), provide customer support, maintain security, and comply with legal obligations.
        </p>

        <h2>Sharing</h2>
        <p>
          We share data with service providers that help us run the platform (cloud hosting, email
          delivery, authentication). We do not sell your personal information. Property data is
          visible only to members you authorize on each property workspace.
        </p>

        <h2>Security & Retention</h2>
        <p>
          We use industry-standard safeguards to protect data in transit and at rest. We retain
          account and property data while your account is active. If you delete your account, we
          delete or anonymize personal data within a reasonable period, subject to legal retention
          requirements.
        </p>

        <h2>Your Rights</h2>
        <p>
          Depending on your location, you may request access, correction, deletion, or export of
          your personal data. Contact{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> to exercise these rights.
        </p>

        <h2>Changes</h2>
        <p>
          We may update this policy from time to time. Material changes will be posted on this page
          with an updated &quot;Last updated&quot; date. Continued use of {APP_NAME} after changes
          constitutes acceptance.
        </p>

        <p>
          Questions? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </LegalProse>
    </MarketingLayout>
  );
}
