import { Suspense } from "react";

import { UnsubscribeContent } from "./unsubscribe-content";

export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex flex-col items-center justify-center px-6 py-24">
          <p className="text-foreground/60">Loading...</p>
        </main>
      }
    >
      <UnsubscribeContent />
    </Suspense>
  );
}
