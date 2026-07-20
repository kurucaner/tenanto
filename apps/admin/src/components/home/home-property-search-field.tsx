import { memo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { SearchFilterField } from "@/components/filters/search-filter-field";
import { Button } from "@/components/ui/button";

export function buildPropertiesListSearchPath(query: string): string {
  const trimmed = query.trim();
  if (trimmed === "") {
    return "/properties";
  }

  return `/properties?q=${encodeURIComponent(trimmed)}`;
}

export const HomePropertySearchField = memo(() => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const handleSubmit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    navigate(buildPropertiesListSearchPath(query));
  };

  return (
    <section aria-label="Find property" className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">Find property</h2>
        <p className="text-muted-foreground text-sm">Search by name or address across your portfolio.</p>
      </div>
      <form className="flex flex-col gap-3 sm:flex-row sm:items-center" onSubmit={handleSubmit}>
        <SearchFilterField
          className="w-full sm:max-w-md"
          id="home-property-search"
          onChange={setQuery}
          placeholder="Search by name or address…"
          value={query}
        />
        <Button className="shrink-0" type="submit" variant="secondary">
          Search properties
        </Button>
      </form>
    </section>
  );
});
HomePropertySearchField.displayName = "HomePropertySearchField";
