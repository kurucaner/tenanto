import { ArrowRight, Building2 } from "lucide-react";
import { memo } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const HomeWorkspaceEmptyState = memo(() => (
  <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
    <CardHeader>
      <div className="flex items-center gap-2 text-primary">
        <Building2 className="size-4" />
        <CardTitle className="text-base font-semibold">No properties yet</CardTitle>
      </div>
      <CardDescription>
        Browse your portfolio or create a property to start tracking units, leases, and income.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <Button asChild className="gap-2" variant="secondary">
        <Link to="/properties">
          Browse properties
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    </CardContent>
  </Card>
));
HomeWorkspaceEmptyState.displayName = "HomeWorkspaceEmptyState";
