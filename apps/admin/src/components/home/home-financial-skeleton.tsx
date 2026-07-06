import { memo } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const HomeFinancialSkeleton = memo(() => (
  <div className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <Card key={i}>
          <CardContent className="space-y-2 p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-28" />
          </CardContent>
        </Card>
      ))}
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardContent className="p-4">
          <Skeleton className="mb-4 h-4 w-40" />
          <Skeleton className="aspect-video w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <Skeleton className="mb-4 h-4 w-44" />
          <Skeleton className="aspect-video w-full" />
        </CardContent>
      </Card>
    </div>
  </div>
));
HomeFinancialSkeleton.displayName = "HomeFinancialSkeleton";
