import { Star } from "lucide-react";
import { memo } from "react";

import { TableIconButton } from "@/components/table/table-icon-button";
import { cn } from "@/lib/utils";

interface PropertyFavoriteButtonProps {
  disabled?: boolean;
  isFavorite: boolean;
  onToggle: () => void;
}

export const PropertyFavoriteButton = memo(
  ({ disabled = false, isFavorite, onToggle }: PropertyFavoriteButtonProps) => (
    <TableIconButton
      ariaLabel={isFavorite ? "Remove from favorites" : "Add to favorites"}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      tooltip={isFavorite ? "Remove from favorites" : "Add to favorites"}
    >
      <Star
        className={cn(
          "size-3.5",
          isFavorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
        )}
      />
    </TableIconButton>
  )
);
PropertyFavoriteButton.displayName = "PropertyFavoriteButton";
