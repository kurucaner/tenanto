import { useCallback, useEffect, useState } from "react";

import {
  getDebouncedUrlCommitValue,
  resolveDebouncedUrlInputValue,
  shouldCommitDebouncedUrlValue,
} from "@/hooks/use-debounced-url-filter-utils";
import { LIST_SEARCH_DEBOUNCE_MS } from "@/packages/shared";

interface UseDebouncedUrlFilterOptions {
  committedValue: string;
  debounceMs?: number;
  onCommit: (value: string) => void;
}

export function useDebouncedUrlFilter({
  committedValue,
  debounceMs = LIST_SEARCH_DEBOUNCE_MS,
  onCommit,
}: UseDebouncedUrlFilterOptions): {
  inputValue: string;
  onInputChange: (value: string) => void;
} {
  const [draftValue, setDraftValue] = useState<string | null>(null);
  const inputValue = resolveDebouncedUrlInputValue(draftValue, committedValue);

  useEffect(() => {
    if (draftValue === null) {
      return;
    }

    const id = setTimeout(() => {
      if (shouldCommitDebouncedUrlValue(draftValue, committedValue)) {
        onCommit(getDebouncedUrlCommitValue(draftValue));
        setDraftValue(null);
      }
    }, debounceMs);

    return () => clearTimeout(id);
  }, [committedValue, debounceMs, draftValue, onCommit]);

  const onInputChange = useCallback((value: string) => {
    setDraftValue(value);
  }, []);

  return { inputValue, onInputChange };
}
