import { AlertTriangle } from "lucide-react";
import { memo, useEffect } from "react";
import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { trackDatadogRumError } from "@/lib/datadog-rum";

const ErrorPageInner = memo(() => {
  const error = useRouteError();

  useEffect(() => {
    if (error instanceof Error) {
      trackDatadogRumError(error, { source: "react-router" });
      return;
    }

    if (isRouteErrorResponse(error)) {
      trackDatadogRumError(`${error.status} ${error.statusText}`, {
        source: "react-router",
        status: error.status,
      });
      return;
    }

    trackDatadogRumError("Unknown route error", { source: "react-router" });
  }, [error]);

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
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-7 text-destructive" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      <Button asChild variant="outline">
        <Link to="/home">Go to home</Link>
      </Button>
    </div>
  );
});
ErrorPageInner.displayName = "ErrorPageInner";

export const ErrorPage = ErrorPageInner;
