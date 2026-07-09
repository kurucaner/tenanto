import { RefreshCw } from "lucide-react";
import { memo, useCallback } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TRefetchButtonProps = {
  isRefetching: boolean;
  label?: string;
  onRefetch: () => void | Promise<void>;
};

export const RefetchButton = memo(
  ({ isRefetching, label = "Refresh", onRefetch }: Readonly<TRefetchButtonProps>) => {
    const handleClick = useCallback(() => {
      void Promise.resolve(onRefetch()).catch(() => {});
    }, [onRefetch]);

    return (
      <Button
        aria-label={label}
        disabled={isRefetching}
        onClick={handleClick}
        size="icon-xs"
        type="button"
        variant="outline"
      >
        <RefreshCw aria-hidden className={cn(isRefetching ? "animate-spin" : undefined)} />
      </Button>
    );
  }
);
RefetchButton.displayName = "RefetchButton";
