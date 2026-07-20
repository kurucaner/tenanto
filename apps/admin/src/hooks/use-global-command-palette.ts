import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { useHomeSearchFocus } from "@/contexts/home-search-focus-context";

const COMMAND_PALETTE_SHORTCUT_KEY = "k";

export function useGlobalCommandPalette() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const homeSearchFocus = useHomeSearchFocus();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key?.toLowerCase();
      if (key !== COMMAND_PALETTE_SHORTCUT_KEY) {
        return;
      }

      if (!(event.metaKey || event.ctrlKey)) {
        return;
      }

      event.preventDefault();

      if (location.pathname === "/home") {
        homeSearchFocus?.focusSearch();
        return;
      }

      setOpen((current) => !current);
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [homeSearchFocus, location.pathname]);

  return {
    open,
    setOpen,
  };
}
