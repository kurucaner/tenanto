"use client";

import { useEffect, useRef } from "react";

const RETURN_TITLE = "👋 Don't leave us";

export function TitleOnVisibility(): null {
  const lastTitleRef = useRef<string | null>(null);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // Store whatever Next/route currently set so we can restore it later.
        lastTitleRef.current = document.title;
        document.title = RETURN_TITLE;
        return;
      }

      if (document.visibilityState === "visible" && lastTitleRef.current != null) {
        document.title = lastTitleRef.current;
        lastTitleRef.current = null;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
