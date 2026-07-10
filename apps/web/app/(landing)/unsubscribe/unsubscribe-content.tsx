"use client";

import { useSearchParams } from "next/navigation";

import { MarketingLayout } from "@/components/landing/marketing-layout";
import { APP_NAME, SUPPORT_EMAIL } from "@/packages/shared";

function getErrorTitle(error: string | null): string {
  if (error === "missing") return "Missing unsubscribe link";
  return "Invalid or expired link";
}

function getView(success: string | null, error: string | null): "success" | "error" | "default" {
  if (success === "1") return "success";
  if (error) return "error";
  return "default";
}

export function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const error = searchParams.get("error");
  const view = getView(success, error);

  return (
    <MarketingLayout>
      <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-24">
        <div className="mx-auto max-w-md space-y-8 text-center">
          {view === "success" ? (
            <>
              <span className="text-ember text-xs font-medium tracking-[0.3em] uppercase">
                Unsubscribed
              </span>
              <h1 className="font-display text-3xl font-bold md:text-4xl">
                You&apos;ve been unsubscribed
              </h1>
              <p className="text-mist/60 leading-relaxed">
                You will no longer receive marketing emails from {APP_NAME}.
              </p>
            </>
          ) : null}
          {view === "error" ? (
            <>
              <span className="text-ember text-xs font-medium tracking-[0.3em] uppercase">
                Unable to unsubscribe
              </span>
              <h1 className="font-display text-3xl font-bold md:text-4xl">
                {getErrorTitle(error)}
              </h1>
              <p className="text-mist/60 leading-relaxed">
                This unsubscribe link is invalid or has expired. Contact{" "}
                <a className="text-ember hover:text-mist" href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>{" "}
                if you continue to receive emails.
              </p>
            </>
          ) : null}
          {view === "default" ? (
            <>
              <span className="text-ember text-xs font-medium tracking-[0.3em] uppercase">
                Unsubscribe
              </span>
              <h1 className="font-display text-3xl font-bold md:text-4xl">
                Use the link in your email
              </h1>
              <p className="text-mist/60 leading-relaxed">
                To unsubscribe from {APP_NAME} emails, use the unsubscribe link in any email
                we&apos;ve sent you.
              </p>
            </>
          ) : null}
        </div>
      </main>
    </MarketingLayout>
  );
}
