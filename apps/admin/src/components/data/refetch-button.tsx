import { RefreshCw } from "lucide-react";
import { memo, useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TRefetchButtonProps = {
  isRefetching: boolean;
  label?: string;
  onRefetch: () => void | Promise<void>;
};

export const RefetchButton = memo(
  ({ isRefetching, label = "Refresh", onRefetch }: Readonly<TRefetchButtonProps>) => {
    const [isAnimating, setIsAnimating] = useState(false);
    const isSpinning = isRefetching || isAnimating;

    const handleClick = useCallback(() => {
      setIsAnimating(true);
      void Promise.resolve(onRefetch())
        .catch(() => {})
        .finally(() => {
          setIsAnimating(false);
        });
    }, [onRefetch]);

    return (
      <Button
        aria-busy={isSpinning}
        aria-label={label}
        disabled={isSpinning}
        onClick={handleClick}
        size="icon-xs"
        type="button"
        variant="outline"
      >
        <RefreshCw
          aria-hidden
          className={cn(
            isSpinning
              ? "animate-spin motion-reduce:animate-none [animation-duration:1.15s]"
              : undefined
          )}
        />
      </Button>
    );
  }
);
RefetchButton.displayName = "RefetchButton";
