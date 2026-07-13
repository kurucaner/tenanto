import { Search } from "lucide-react";
import { memo } from "react";

import { FilterField } from "@/components/filters/filter-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface SearchFilterFieldProps {
  className?: string;
  id: string;
  label?: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}

const SearchInput = memo(
  ({ className, id, onChange, placeholder, value }: Omit<SearchFilterFieldProps, "label">) => (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="pl-9"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </div>
  )
);
SearchInput.displayName = "SearchInput";

export const SearchFilterField = memo(
  ({ className, id, label, onChange, placeholder, value }: SearchFilterFieldProps) => {
    if (label) {
      return (
        <FilterField className={className}>
          <Label htmlFor={id}>{label}</Label>
          <SearchInput id={id} onChange={onChange} placeholder={placeholder} value={value} />
        </FilterField>
      );
    }

    return (
      <SearchInput
        className={className}
        id={id}
        onChange={onChange}
        placeholder={placeholder}
        value={value}
      />
    );
  }
);
SearchFilterField.displayName = "SearchFilterField";
