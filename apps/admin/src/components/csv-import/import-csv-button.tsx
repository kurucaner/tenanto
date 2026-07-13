import { Sparkles } from "lucide-react";
import { memo } from "react";

import { Button } from "@/components/ui/button";

interface ImportCsvButtonProps {
  disabled?: boolean;
  onClick: () => void;
}

export const ImportCsvButton = memo(({ disabled, onClick }: ImportCsvButtonProps) => (
  <Button
    className="gap-1.5"
    disabled={disabled}
    onClick={onClick}
    size="sm"
    type="button"
    variant="outline"
  >
    <Sparkles className="size-3.5" />
    Import CSV
  </Button>
));
ImportCsvButton.displayName = "ImportCsvButton";
