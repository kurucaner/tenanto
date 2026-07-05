import { SearchX } from "lucide-react";
import { memo } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

const NotFoundPageInner = memo(() => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
    <div className="flex flex-col items-center gap-3">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <SearchX className="size-7 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The page you're looking for doesn't exist or has been moved.
      </p>
    </div>
    <Button asChild variant="outline">
      <Link to="/home">Go to home</Link>
    </Button>
  </div>
));
NotFoundPageInner.displayName = "NotFoundPageInner";

export const NotFoundPage = NotFoundPageInner;
