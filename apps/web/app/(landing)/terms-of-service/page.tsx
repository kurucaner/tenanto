import { LegalProse } from "@/components/landing/legal-prose";
import { MarketingLayout } from "@/components/landing/marketing-layout";
import { pageMetadata } from "@/lib/marketing-content";
import { APP_NAME, SUPPORT_EMAIL } from "@/packages/shared";

export const metadata = pageMetadata(
  "Terms of Service",
  `Terms of Service for ${APP_NAME} property management platform.`
);

export default function TermsOfServicePage() {
  return (
    <MarketingLayout>
      <LegalProse title="Terms of Service">
        <p>
          Last updated: March 1, 2026. These Terms of Service (&quot;Terms&quot;) govern your access
          to and use of {APP_NAME}, including our website, admin application, APIs, and related
          services (collectively, the &quot;Service&quot;).
        </p>
        <p>
          By creating an account or using the Service, you agree to these Terms. If you use the
          Service on behalf of a company, you represent that you have authority to bind that
          organization.
        </p>

        <h2>The Service</h2>
        <p>
          {APP_NAME} helps rental operators track properties, units, leases, reservations, income,
          expenses, and financial reports. Features may change over time. We may add, modify, or
          discontinue features with reasonable notice when practical.
        </p>

        <h2>Accounts & Access</h2>
        <p>
          You are responsible for safeguarding your credentials and for activity under your account.
          Property workspaces support role-based access (owner, manager, accountant). You are
          responsible for inviting only trusted collaborators and for the accuracy of data entered
          into the Service.
        </p>

        <h2>Acceptable Use</h2>
        <p>
          You may not misuse the Service, attempt unauthorized access, interfere with other users,
          upload malware, or use the platform for unlawful purposes. We may suspend or terminate
          accounts that violate these Terms.
        </p>

        <h2>Your Data</h2>
        <p>
          You retain ownership of property and financial data you submit. You grant us a limited
          license to host, process, and display that data solely to provide the Service. You are
          responsible for ensuring you have the right to upload and process the data you enter.
        </p>

        <h2>Disclaimers</h2>
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE.&quot; {APP_NAME} IS A
          SOFTWARE TOOL, NOT TAX, LEGAL, OR ACCOUNTING ADVICE. REPORTS AND CALCULATIONS ARE PROVIDED
          FOR OPERATIONAL CONVENIENCE; YOU ARE RESPONSIBLE FOR VERIFYING FIGURES AND COMPLYING WITH
          APPLICABLE LAWS.
        </p>

        <h2>Limitation of Liability</h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, {APP_NAME} SHALL NOT BE LIABLE FOR INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR
          GOODWILL. OUR TOTAL LIABILITY FOR CLAIMS ARISING FROM THE SERVICE SHALL NOT EXCEED THE
          AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS BEFORE THE CLAIM, OR ONE HUNDRED U.S. DOLLARS
          ($100), WHICHEVER IS GREATER.
        </p>

        <h2>Termination</h2>
        <p>
          You may stop using the Service at any time. We may suspend or terminate access for
          violations of these Terms or to protect the Service. Upon termination, your right to use
          the Service ends. Data handling after termination is described in our Privacy Policy.
        </p>

        <h2>Governing Law</h2>
        <p>
          These Terms are governed by the laws of the State of Delaware, USA, without regard to
          conflict-of-law principles.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about these Terms: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </LegalProse>
    </MarketingLayout>
  );
}
