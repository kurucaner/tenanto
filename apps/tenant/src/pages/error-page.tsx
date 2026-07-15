import { AlertTriangle } from "lucide-react";
import { memo, useEffect } from "react";
import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";

import { syncDocumentTitle } from "@/lib/document-title";
import { Button } from "@/packages/app-ui";

export const ErrorPage = memo(function ErrorPage() {
  const error = useRouteError();

  useEffect(() => {
    syncDocumentTitle("Something went wrong");
  }, []);

  const isNotFound = isRouteErrorResponse(error) && error.status === 404;

  const title = isNotFound ? "Page not found" : "Something went wrong";

  let description: string;
  if (isNotFound) {
    description = "The page you're looking for doesn't exist or has been moved.";
  } else if (error instanceof Error) {
    description = error.message;
  } else if (isRouteErrorResponse(error)) {
    description = `${error.status} ${error.statusText}`;
  } else {
    description = "An unexpected error occurred.";
  }

  return (
    <div className="app-surface flex min-h-svh flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-7 text-destructive" />
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      <Button asChild type="button" variant="outline">
        <Link to="/">Go to home</Link>
      </Button>
    </div>
  );
});
ErrorPage.displayName = "ErrorPage";
