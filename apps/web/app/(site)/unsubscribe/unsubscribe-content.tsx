"use client";

import { useSearchParams } from "next/navigation";

import { APP_NAME } from "@/packages/shared";

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
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-24">
      <div className="mx-auto max-w-md space-y-8 text-center">
        {view === "success" && (
          <>
            <span className="text-[var(--gold)] font-medium tracking-[0.3em] uppercase text-xs">
              Unsubscribed
            </span>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-medium text-foreground md:text-4xl">
              You&apos;ve been unsubscribed
            </h1>
            <p className="text-foreground/60 leading-relaxed">
              You will no longer receive vault release emails from {APP_NAME}.
            </p>
          </>
        )}
        {view === "error" && (
          <>
            <span className="text-[var(--gold)] font-medium tracking-[0.3em] uppercase text-xs">
              Unable to unsubscribe
            </span>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-medium text-foreground md:text-4xl">
              {getErrorTitle(error)}
            </h1>
            <p className="text-foreground/60 leading-relaxed">
              This unsubscribe link is invalid or has expired. If you continue to receive emails,
              please contact support.
            </p>
          </>
        )}
        {view === "default" && (
          <>
            <span className="text-[var(--gold)] font-medium tracking-[0.3em] uppercase text-xs">
              Unsubscribe
            </span>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-medium text-foreground md:text-4xl">
              Use the link in your email
            </h1>
            <p className="text-foreground/60 leading-relaxed">
              To unsubscribe from {APP_NAME} emails, use the unsubscribe link in any email
              we&apos;ve sent you.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
