import { SearchX } from "lucide-react";
import { memo, useEffect } from "react";
import { Link } from "react-router-dom";

import { syncDocumentTitle } from "@/lib/document-title";
import { Button } from "@/packages/app-ui";

export const NotFoundPage = memo(function NotFoundPage() {
  useEffect(() => {
    syncDocumentTitle("Page not found");
  }, []);

  return (
    <div className="app-surface flex min-h-svh flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted">
          <SearchX className="size-7 text-muted-foreground" />
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
      </div>
      <Button asChild type="button" variant="outline">
        <Link to="/">Go to home</Link>
      </Button>
    </div>
  );
});
NotFoundPage.displayName = "NotFoundPage";
