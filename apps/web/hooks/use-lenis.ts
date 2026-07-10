"use client";

import Lenis from "lenis";
import { useEffect } from "react";

/** Buttery-smooth scrolling. Native scroll position still updates,
 *  so Motion's useScroll stays perfectly in sync. */
export function useLenis() {
  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.09,
      touchMultiplier: 1.4,
      wheelMultiplier: 1,
    });

    let rafId: number;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);
}
