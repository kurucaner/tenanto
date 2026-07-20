import { ArrowRight, BarChart3 } from "lucide-react";
import { memo } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const HomePortfolioReportsLink = memo(() => (
  <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md">
    <CardHeader className="pb-2">
      <div className="flex items-center gap-2 text-primary">
        <BarChart3 className="size-4" />
        <CardTitle className="text-base font-semibold">Portfolio reports</CardTitle>
      </div>
      <CardDescription>
        View income, expenses, and net performance across your properties.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <Button asChild className="gap-2" variant="secondary">
        <Link to="/reports">
          View portfolio reports
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    </CardContent>
  </Card>
));
HomePortfolioReportsLink.displayName = "HomePortfolioReportsLink";
