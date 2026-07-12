import { memo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type TTableIconButtonProps = {
  ariaLabel: string;
  asChild?: boolean;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  tooltip: ReactNode;
} & Omit<React.ComponentProps<typeof Button>, "aria-label" | "children">;

export const TableIconButton = memo(
  ({
    ariaLabel,
    asChild = false,
    children,
    className,
    disabled,
    tooltip,
    ...buttonProps
  }: TTableIconButtonProps) => {
    const triggerContent = asChild ? (
      children
    ) : (
      <Button
        aria-label={ariaLabel}
        className={className}
        disabled={disabled}
        size="icon-sm"
        type="button"
        variant="ghost"
        {...buttonProps}
      >
        {children}
      </Button>
    );

    const trigger = disabled ? (
      <span className="inline-flex">{triggerContent}</span>
    ) : (
      triggerContent
    );

    return (
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent side="top">{tooltip}</TooltipContent>
      </Tooltip>
    );
  }
);
TableIconButton.displayName = "TableIconButton";
