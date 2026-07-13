import { useDebouncedUrlFilter } from "@/hooks/use-debounced-url-filter";

export function useLedgerUrlSearch(
  q: string,
  setFilter: (key: "q", value: string) => void
): { onSearchInputChange: (value: string) => void; searchInput: string } {
  const { inputValue, onInputChange } = useDebouncedUrlFilter({
    committedValue: q,
    onCommit: (value) => setFilter("q", value),
  });

  return { onSearchInputChange: onInputChange, searchInput: inputValue };
}
