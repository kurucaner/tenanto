import { memo } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const ReportChartsSkeleton = memo(() => (
  <div className="space-y-4">
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 4 }, (_, index) => (
        <Card key={index}>
          <CardContent className="space-y-4 p-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mx-auto aspect-square h-[220px] max-w-[220px] rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 2 }, (_, index) => (
        <Card key={index}>
          <CardContent className="space-y-4 p-4">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="aspect-video w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
));
ReportChartsSkeleton.displayName = "ReportChartsSkeleton";
