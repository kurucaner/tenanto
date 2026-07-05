import { SecondaryPageLayout } from "@/components/secondary-page-layout";
import { APP_NAME, SUPPORT_EMAIL } from "@/packages/shared";

export const metadata = {
  title: `Contact | ${APP_NAME}`,
  description: `Contact ${APP_NAME} support and inquiries.`,
};

export default function ContactPage() {
  return (
    <SecondaryPageLayout>
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-12 font-[family-name:var(--font-display)] text-4xl font-medium text-foreground md:text-5xl">
          Contact
        </h1>
        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-foreground/80">
          <p className="leading-relaxed">
            We&apos;d love to hear from you. For support, feedback, or general inquiries, reach out
            using the options below.
          </p>
          <div className="mt-12 space-y-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-8">
            <div>
              <h2 className="mb-2 font-[family-name:var(--font-display)] text-lg font-medium text-[var(--gold)]">
                Support
              </h2>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-foreground/80 underline transition-colors hover:text-[var(--gold)]"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
            <div>
              <h2 className="mb-2 font-[family-name:var(--font-display)] text-lg font-medium text-[var(--gold)]">
                General Inquiries
              </h2>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-foreground/80 underline transition-colors hover:text-[var(--gold)]"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
          <p className="mt-12 text-sm text-foreground/50">
            We typically respond within 24–48 hours.
          </p>
        </div>
      </div>
    </SecondaryPageLayout>
  );
}
