import { SecondaryPageLayout } from "@/components/secondary-page-layout";
import { APP_NAME, SUPPORT_EMAIL } from "@/packages/shared";

export const metadata = {
  title: `Terms of Use | ${APP_NAME}`,
  description: `Terms of Use for ${APP_NAME} digital vault app.`,
};

export default function TermsPage() {
  return (
    <SecondaryPageLayout>
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-12 font-[family-name:var(--font-display)] text-4xl font-medium text-foreground md:text-5xl">
          Terms of Use
        </h1>
        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-foreground/80">
          <p className="leading-relaxed">
            Last updated: 3/1/2026. Please read these Terms of Use carefully before using the
            {APP_NAME} app and services.
          </p>
          <p className="leading-relaxed">
            By accessing or using {APP_NAME}, you agree to be bound by these Terms. If you do not
            agree, do not use our services.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Definitions
          </h2>
          <p className="leading-relaxed">
            &quot;{APP_NAME},&quot; &quot;we,&quot; &quot;us,&quot; and &quot;our&quot; refer to the
            entity operating the {APP_NAME} service. &quot;You&quot; and &quot;your&quot; refer to
            the user of our services.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Acceptance of Terms
          </h2>
          <p className="leading-relaxed">
            These Terms of Use constitute a legally binding agreement between you and {APP_NAME}
            regarding your use of our digital legacy vault application. Your continued use of the
            service constitutes acceptance of these terms.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Service Description
          </h2>
          <p className="leading-relaxed">
            {APP_NAME} provides a secure digital vault for storing and delivering legacy content to
            designated recipients. Your vault content is stored in secure cloud storage, encrypted
            with 4096-bit RSA keys, and accessible only by our automated systems for service
            operations. We do not guarantee that designated recipients will receive your vault
            content; delivery depends on your check-in schedule and the recipient&apos;s ability to
            access the service.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Your Responsibilities
          </h2>
          <p className="leading-relaxed">
            You are responsible for: (a) maintaining the confidentiality of your account credentials
            and passcode; (b) ensuring your check-in schedule is met; (c) the content you store and
            the recipients you designate; and (d) ensuring your use of the service complies with
            applicable laws. You acknowledge that if you miss check-ins, your vault may be released
            to designated recipients, and we are not liable for any consequences of such release.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Prohibited Uses
          </h2>
          <p className="leading-relaxed">
            You may not use {APP_NAME} to store or transmit illegal content, harass others, violate
            intellectual property rights, or engage in any unlawful activity. We reserve the right
            to suspend or terminate your account and remove content that violates these Terms or
            applicable law.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Disclaimer of Warranties
          </h2>
          <p className="leading-relaxed">
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT
            WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DISCLAIM ALL WARRANTIES, INCLUDING
            IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
            NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR
            ERROR-FREE.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Limitation of Liability
          </h2>
          <p className="leading-relaxed">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, {APP_NAME} AND ITS AFFILIATES, OFFICERS,
            DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
            SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF DATA, PROFITS, OR GOODWILL.
            OUR TOTAL LIABILITY FOR ANY CLAIMS ARISING FROM OR RELATED TO THESE TERMS OR THE SERVICE
            SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS
            PRECEDING THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS ($100).
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Indemnification
          </h2>
          <p className="leading-relaxed">
            You agree to indemnify, defend, and hold harmless {APP_NAME} and its affiliates,
            officers, directors, employees, and agents from and against any claims, damages, losses,
            liabilities, and expenses (including reasonable attorneys&apos; fees) arising from your
            use of the service, your content, your violation of these Terms, or your violation of
            any third-party rights.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Subscriptions and Refunds
          </h2>
          <p className="leading-relaxed">
            Premium subscriptions are billed through the Apple App Store or Google Play. We do not
            offer refunds or returns for subscription purchases. Cancellation will stop future
            charges; you retain access until the end of your current billing period. For refund
            requests, contact Apple or Google directly per their policies.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Account Termination
          </h2>
          <p className="leading-relaxed">
            You may delete your account at any time through the app. We may suspend or terminate
            your account for violation of these Terms or for any other reason at our discretion.
            Upon termination, your right to use the service ceases. We may retain or delete your
            data in accordance with our Privacy Policy.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Force Majeure
          </h2>
          <p className="leading-relaxed">
            We shall not be liable for any failure or delay in performing our obligations due to
            circumstances beyond our reasonable control, including but not limited to acts of God,
            natural disasters, war, terrorism, pandemics, government actions, or failures of
            third-party services.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Severability
          </h2>
          <p className="leading-relaxed">
            If any provision of these Terms is found to be unenforceable, the remaining provisions
            shall remain in full force and effect.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Governing Law
          </h2>
          <p className="leading-relaxed">
            These Terms shall be governed by and construed in accordance with the laws of the United
            States and the State of Delaware, without regard to conflict of law principles.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Changes to These Terms
          </h2>
          <p className="leading-relaxed">
            We may update these Terms from time to time. We will notify you of material changes by
            posting the updated Terms on this page and updating the &quot;Last updated&quot; date.
            Your continued use of {APP_NAME} after changes constitutes acceptance of the updated
            Terms.
          </p>

          <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-medium text-foreground">
            Contact
          </h2>
          <p className="leading-relaxed">
            For questions about these Terms, contact us at{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[var(--gold)] hover:underline">
              {SUPPORT_EMAIL}
            </a>
            {"."}
          </p>
        </div>
      </div>
    </SecondaryPageLayout>
  );
}
