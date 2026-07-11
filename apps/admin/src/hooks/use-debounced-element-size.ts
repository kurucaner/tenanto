import { type RefObject, useEffect, useState } from "react";

type ElementSize = {
  width: number;
  height: number;
};

type UseDebouncedElementSizeOptions = {
  debounceMs?: number;
  initialSize: ElementSize;
};

function roundSize({ height, width }: ElementSize): ElementSize {
  return {
    height: Math.round(height),
    width: Math.round(width),
  };
}

export function useDebouncedElementSize(
  ref: RefObject<HTMLElement | null>,
  { debounceMs = 200, initialSize }: UseDebouncedElementSizeOptions
): ElementSize {
  const [size, setSize] = useState<ElementSize>(() => roundSize(initialSize));

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    let hasMeasured = false;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    const applySize = (nextSize: ElementSize) => {
      const rounded = roundSize(nextSize);
      setSize((current) =>
        current.width === rounded.width && current.height === rounded.height ? current : rounded
      );
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const { height, width } = entry.contentRect;
      if (width <= 0 || height <= 0) {
        return;
      }

      if (!hasMeasured) {
        hasMeasured = true;
        applySize({ height, width });
        return;
      }

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        applySize({ height, width });
      }, debounceMs);
    });

    observer.observe(element);

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      observer.disconnect();
    };
  }, [debounceMs, ref]);

  return size;
}
