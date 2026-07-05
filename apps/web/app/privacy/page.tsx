import { SecondaryPageLayout } from "@/components/secondary-page-layout";
import { APP_NAME, SUPPORT_EMAIL } from "@/packages/shared";

export const metadata = {
  title: `Privacy Policy | ${APP_NAME}`,
  description: `Privacy Policy for ${APP_NAME} digital vault app.`,
};

export default function PrivacyPage() {
  return (
    <SecondaryPageLayout>
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-12 font-[family-name:var(--font-display)] text-4xl font-medium text-foreground md:text-5xl">
          Privacy Policy
        </h1>
        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-foreground/80">
          <p className="leading-relaxed">
            Last updated: 3/1/2026. {APP_NAME} (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
            is committed to protecting your privacy. This policy explains how we collect, use, and
            safeguard your information. For questions about this policy, contact us at{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[var(--gold)] hover:underline">
              {SUPPORT_EMAIL}
            </a>
            {"."}
          </p>
          <p className="leading-relaxed">
            Your vault content is stored in secure cloud storage. No one has access to view or
            control the data in our storage systems other than our automated systems, which access
            it only as necessary to operate the service. All data is encrypted using 4096-bit RSA
            keys. These encryption keys are stored and managed in a way that prevents any human
            access.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Information We Collect
          </h2>
          <p className="leading-relaxed">
            We collect account information (email, name, authentication provider data), usage
            metadata (app version, platform, device information), push notification tokens, and
            support communications. We do not have access to view or decrypt your vault content;
            only our automated systems can operate on the stored data as needed to deliver the
            service.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            How We Use Your Information
          </h2>
          <p className="leading-relaxed">
            We use your information to provide and improve our services, authenticate your account,
            send important notifications (including check-in reminders and vault release alerts),
            troubleshoot issues, and comply with legal obligations.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Third-Party Services
          </h2>
          <p className="leading-relaxed">
            We use third-party services to operate {APP_NAME}: cloud storage (AWS), authentication
            (Google, Apple), push notifications (Expo/FCM), and hosting infrastructure. These
            providers process data on our behalf under contractual obligations. We do not sell your
            personal information to third parties.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Data Retention
          </h2>
          <p className="leading-relaxed">
            We retain your account data for as long as your account is active. When you delete your
            account, we delete or anonymize your personal data within a reasonable period. Vault
            content may be retained in backup systems for a limited time before permanent deletion.
            We may retain certain data as required by law.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Your Rights
          </h2>
          <p className="leading-relaxed">
            Depending on your location, you may have the right to access, correct, delete, or export
            your personal data. You may also object to or restrict certain processing. To exercise
            these rights, contact us at{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[var(--gold)] hover:underline">
              {SUPPORT_EMAIL}
            </a>
            {". "}
            If you are in the European Economic Area, you have the right to lodge a complaint with
            your local data protection authority.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Changes to This Policy
          </h2>
          <p className="leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify you of material
            changes by posting the updated policy on this page and updating the &quot;Last
            updated&quot; date. Your continued use of {APP_NAME} after changes constitutes
            acceptance of the updated policy.
          </p>
        </div>
      </div>
    </SecondaryPageLayout>
  );
}
