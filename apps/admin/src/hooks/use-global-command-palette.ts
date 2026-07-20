import { useEffect, useState } from "react";

const COMMAND_PALETTE_SHORTCUT_KEY = "k";

export function useGlobalCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== COMMAND_PALETTE_SHORTCUT_KEY) {
        return;
      }

      if (!(event.metaKey || event.ctrlKey)) {
        return;
      }

      event.preventDefault();
      setOpen((current) => !current);
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, []);

  return {
    open,
    setOpen,
  };
}
