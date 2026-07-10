import { SecondaryPageLayout } from "@/components/secondary-page-layout";
import { APP_NAME, SUPPORT_EMAIL } from "@/packages/shared";

export const metadata = {
  description: `Terms of Service for ${APP_NAME} property management platform.`,
  title: `Terms of Service | ${APP_NAME}`,
};

export default function TermsOfServicePage() {
  return (
    <SecondaryPageLayout>
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-12 font-[family-name:var(--font-display)] text-4xl font-medium text-foreground md:text-5xl">
          Terms of Service
        </h1>
        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-foreground/80">
          <p className="leading-relaxed">
            Last updated: March 1, 2026. These Terms of Service (&quot;Terms&quot;) govern your
            access to and use of {APP_NAME}, including our website, admin application, APIs, and
            related services (collectively, the &quot;Service&quot;).
          </p>
          <p className="leading-relaxed">
            By creating an account or using the Service, you agree to these Terms. If you use the
            Service on behalf of a company, you represent that you have authority to bind that
            organization.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            The Service
          </h2>
          <p className="leading-relaxed">
            {APP_NAME} helps rental operators track properties, units, leases, reservations,
            income, expenses, and financial reports. Features may change over time. We may add,
            modify, or discontinue features with reasonable notice when practical.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Accounts & Access
          </h2>
          <p className="leading-relaxed">
            You are responsible for safeguarding your credentials and for activity under your
            account. Property workspaces support role-based access (owner, manager, accountant).
            You are responsible for inviting only trusted collaborators and for the accuracy of data
            entered into the Service.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Acceptable Use
          </h2>
          <p className="leading-relaxed">
            You may not misuse the Service, attempt unauthorized access, interfere with other users,
            upload malware, or use the platform for unlawful purposes. We may suspend or terminate
            accounts that violate these Terms.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Your Data
          </h2>
          <p className="leading-relaxed">
            You retain ownership of property and financial data you submit. You grant us a limited
            license to host, process, and display that data solely to provide the Service. You are
            responsible for ensuring you have the right to upload and process the data you enter.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Disclaimers
          </h2>
          <p className="leading-relaxed">
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE.&quot; {APP_NAME} IS A
            SOFTWARE TOOL, NOT TAX, LEGAL, OR ACCOUNTING ADVICE. REPORTS AND CALCULATIONS ARE
            PROVIDED FOR OPERATIONAL CONVENIENCE; YOU ARE RESPONSIBLE FOR VERIFYING FIGURES AND
            COMPLYING WITH APPLICABLE LAWS.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Limitation of Liability
          </h2>
          <p className="leading-relaxed">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, {APP_NAME} SHALL NOT BE LIABLE FOR INDIRECT,
            INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR
            GOODWILL. OUR TOTAL LIABILITY FOR CLAIMS ARISING FROM THE SERVICE SHALL NOT EXCEED THE
            AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS BEFORE THE CLAIM, OR ONE HUNDRED U.S.
            DOLLARS ($100), WHICHEVER IS GREATER.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Termination
          </h2>
          <p className="leading-relaxed">
            You may stop using the Service at any time. We may suspend or terminate access for
            violations of these Terms or to protect the Service. Upon termination, your right to use
            the Service ends. Data handling after termination is described in our Privacy Policy.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Governing Law
          </h2>
          <p className="leading-relaxed">
            These Terms are governed by the laws of the State of Delaware, USA, without regard to
            conflict-of-law principles.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Contact
          </h2>
          <p className="leading-relaxed">
            Questions about these Terms:{" "}
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
