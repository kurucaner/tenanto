import { LegalProse } from "@/components/landing/legal-prose";
import { MarketingLayout } from "@/components/landing/marketing-layout";
import { pageMetadata } from "@/lib/marketing-content";
import { APP_NAME, SUPPORT_EMAIL } from "@/packages/shared";

export const metadata = pageMetadata(
  "Google Account Data Usage",
  `How ${APP_NAME} uses Google Sign-In and what account data is accessed.`,
);

export default function GoogleDisclosurePage() {
  return (
    <MarketingLayout>
      <LegalProse title="Google Account Data Usage">
        <p>
          Last updated: July 10, 2026. This page explains exactly how {APP_NAME} uses Google
          Sign-In, which Google account data we access, and how that data is handled.
        </p>

        <h2>Why {APP_NAME} Connects to Google</h2>
        <p>
          {APP_NAME} offers <strong>Sign in with Google</strong> as a secure, password-free way for
          operators, managers, and accountants to authenticate into the {APP_NAME} platform. This is
          the sole purpose of the Google integration — we use Google only for identity verification
          and account creation. We do not connect to any Google productivity service (Calendar,
          Gmail, Drive, Sheets, etc.).
        </p>

        <h2>Exact OAuth Scopes Requested</h2>
        <p>
          When you choose &ldquo;Sign in with Google,&rdquo; {APP_NAME} requests the following
          standard OpenID Connect scopes — and nothing else:
        </p>
        <ol>
          <li>
            <strong>openid</strong> — Confirms your identity through Google&apos;s secure token
            system. This is required for all Google Sign-In flows.
          </li>
          <li>
            <strong>email</strong> — Your Google account email address, used as your {APP_NAME}{" "}
            login identifier and for transactional emails (invitations, support replies).
          </li>
          <li>
            <strong>profile</strong> — Your display name from Google, used to pre-fill your name in
            the {APP_NAME} account record so you don&apos;t have to type it manually.
          </li>
        </ol>
        <p>
          We do <strong>not</strong> request access to Google Calendar, Gmail, Google Drive, Google
          Contacts, or any other Google service. The scopes listed above are the complete and
          exhaustive set.
        </p>

        <h2>What Data Is Stored and How</h2>
        <p>When you sign in with Google for the first time, {APP_NAME} stores:</p>
        <ol>
          <li>
            <strong>Your email address</strong> — stored in our database as your account identifier.
          </li>
          <li>
            <strong>Your display name</strong> — stored as your {APP_NAME} display name; you can
            change it at any time in account settings.
          </li>
          <li>
            <strong>Your Google user ID</strong> (an opaque identifier provided by Google) — stored
            so future Google Sign-In attempts can be matched to your existing {APP_NAME} account
            without requiring a password.
          </li>
        </ol>
        <p>
          We do <strong>not</strong> store your Google profile picture, phone number, or any other
          Google account attribute. We do not receive or retain any Google access tokens or refresh
          tokens — the authentication flow uses a one-time ID token that is verified server-side and
          then discarded.
        </p>

        <h2>How Data Is Protected</h2>
        <p>
          All data is encrypted in transit (TLS) and at rest. Your Google user ID is stored
          alongside your {APP_NAME} account record and is accessible only to authenticated platform
          services. {APP_NAME} staff do not have routine access to individual account records.
        </p>

        <h2>Third-Party Sharing</h2>
        <p>
          {APP_NAME} does <strong>not</strong> sell, rent, or share your Google account data with
          third parties for advertising or marketing purposes. The only data sharing that occurs is
          with essential infrastructure providers (cloud hosting, email delivery) strictly for
          operating the {APP_NAME} platform, as described in our{" "}
          <a href="/privacy-policy">Privacy Policy</a>.
        </p>

        <h2>Revoking Access</h2>
        <p>
          You can revoke {APP_NAME}&apos;s access to your Google account at any time from your
          Google Account security settings at{" "}
          <a href="https://myaccount.google.com/permissions" rel="noopener noreferrer" target="_blank">
            myaccount.google.com/permissions
          </a>
          . Revoking access does not delete your {APP_NAME} account or property data; it simply
          means you will need to use email/password to sign in going forward. To delete your{" "}
          {APP_NAME} account entirely, visit our{" "}
          <a href="/delete-account">account deletion page</a>.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about this disclosure or our Google integration? Email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </LegalProse>
    </MarketingLayout>
  );
}
