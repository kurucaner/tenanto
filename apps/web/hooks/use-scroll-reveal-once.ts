"use client";

import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

type UseScrollRevealOnceOptions = Readonly<{
  rootMargin?: string;
  threshold?: number;
}>;

function subscribeReducedMotion(onStoreChange: () => void) {
  const mq = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
  return (
    typeof globalThis.matchMedia === "function" &&
    globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function getReducedMotionServerSnapshot() {
  return false;
}

/**
 * Fires once when `ref` intersects the viewport.
 * Pass a positive bottom `rootMargin` (e.g. `"0px 0px 22% 0px"`) only when you want the
 * animation to start slightly before the section enters the frame.
 */
export function useScrollRevealOnce({
  rootMargin = "0px",
  threshold = 0.04,
}: UseScrollRevealOnceOptions = {}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [revealedByScroll, setRevealedByScroll] = useState(false);
  const prefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  useLayoutEffect(() => {
    if (prefersReducedMotion) return;

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRevealedByScroll(true);
          observer.disconnect();
        }
      },
      { root: null, rootMargin, threshold }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [prefersReducedMotion, rootMargin, threshold]);

  return { ref, isVisible: prefersReducedMotion || revealedByScroll };
}
