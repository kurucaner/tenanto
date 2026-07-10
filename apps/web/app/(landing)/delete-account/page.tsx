import { LegalProse } from "@/components/landing/legal-prose";
import { MarketingLayout } from "@/components/landing/marketing-layout";
import { pageMetadata } from "@/lib/marketing-content";
import { APP_NAME, SUPPORT_EMAIL } from "@/packages/shared";

export const metadata = pageMetadata(
  "Delete Account",
  `How to request deletion of your ${APP_NAME} account and associated data.`,
);

export default function DeleteAccountPage() {
  return (
    <MarketingLayout>
      <LegalProse title="Delete Your Account">
        <p>
          To request deletion of your {APP_NAME} account and associated data, follow the steps
          below. If you no longer have access to the admin app, contact us and we will assist you.
        </p>

        <h2>How to Delete Your Account</h2>
        <ol>
          <li>Sign in to the {APP_NAME} admin app</li>
          <li>Open your account settings</li>
          <li>Select &quot;Delete Account&quot;</li>
          <li>Confirm deletion when prompted</li>
        </ol>

        <h2>What Gets Deleted</h2>
        <p>
          When you delete your account, we delete or anonymize your account data (email, name,
          profile), property memberships, and authentication tokens. Property data you owned may be
          transferred or removed according to workspace rules.
        </p>

        <h2>Need Help?</h2>
        <p>
          If you cannot access the app or need assistance with account deletion, contact us at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. We will respond and help you
          complete the process.
        </p>
      </LegalProse>
    </MarketingLayout>
  );
}
