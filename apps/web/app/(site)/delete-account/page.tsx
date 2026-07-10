import { SecondaryPageLayout } from "@/components/secondary-page-layout";
import { APP_NAME, SUPPORT_EMAIL } from "@/packages/shared";

export const metadata = {
  title: `Delete Account | ${APP_NAME}`,
  description: `How to request deletion of your ${APP_NAME} account and associated data.`,
};

export default function DeleteAccountPage() {
  return (
    <SecondaryPageLayout>
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-12 font-[family-name:var(--font-display)] text-4xl font-medium text-foreground md:text-5xl">
          Delete Your Account
        </h1>
        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-foreground/80">
          <p className="leading-relaxed">
            {APP_NAME} is a mobile app. To request deletion of your account and associated data,
            please follow the steps below. If you no longer have access to the app, you can contact
            us and we will assist you.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            How to Delete Your Account
          </h2>
          <ol className="list-decimal space-y-3 pl-6 leading-relaxed">
            <li>Open the {APP_NAME} app on your device</li>
            <li>Go to Settings (tap your profile or the gear icon)</li>
            <li>Scroll to the Account section</li>
            <li>Tap &quot;Delete Account&quot;</li>
            <li>Tap &quot;Delete my account&quot; and confirm</li>
          </ol>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            What Gets Deleted
          </h2>
          <p className="leading-relaxed">
            When you delete your account, we delete or anonymize your account data (email, name,
            profile), all vaults and their contents, keyholder links, and authentication tokens.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Recovery Period
          </h2>
          <p className="leading-relaxed">
            Your account is deactivated immediately but can be recovered within 30 days by signing
            in again with the same Google or Apple account. After 30 days, your account and data are
            permanently deleted and cannot be recovered. Vault content may remain in backup systems
            for a limited time before permanent deletion. We may retain certain data as required by
            law.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Need Help?
          </h2>
          <p className="leading-relaxed">
            If you cannot access the app or need assistance with account deletion, contact us at{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[var(--gold)] hover:underline">
              {SUPPORT_EMAIL}
            </a>
            {". We will respond and help you complete the process."}
          </p>
        </div>
      </div>
    </SecondaryPageLayout>
  );
}
