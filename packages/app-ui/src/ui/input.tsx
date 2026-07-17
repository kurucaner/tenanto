import { Eye, EyeOff } from "lucide-react";
import * as React from "react";

import { Button } from "../ui/button";
import { cn } from "../lib/utils";

type InputProps = React.ComponentProps<"input"> & {
  showPasswordToggle?: boolean;
};

const inputClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, id, showPasswordToggle, type, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    const isPassword = type === "password";
    const shouldShowPasswordToggle = isPassword && (showPasswordToggle ?? true);

    if (!shouldShowPasswordToggle) {
      return (
        <input
          ref={ref}
          type={type}
          data-slot="input"
          className={cn(inputClassName, className)}
          id={id}
          {...props}
        />
      );
    }

    return (
      <div className="relative w-full">
        <input
          ref={ref}
          type={visible ? "text" : "password"}
          data-slot="input"
          className={cn(inputClassName, "pr-9", className)}
          id={id}
          {...props}
        />
        <Button
          aria-controls={id}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 top-[2px]"
          disabled={props.disabled}
          onClick={() => setVisible((current) => !current)}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </Button>
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
