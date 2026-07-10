import { Suspense } from "react";

import { pageMetadata } from "@/lib/marketing-content";
import { APP_NAME } from "@/packages/shared";

import { UnsubscribeContent } from "./unsubscribe-content";

export const metadata = pageMetadata("Unsubscribe", `Unsubscribe from ${APP_NAME} emails.`);

export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-6 py-24">
          <p className="text-mist/60">Loading...</p>
        </main>
      }
    >
      <UnsubscribeContent />
    </Suspense>
  );
}
