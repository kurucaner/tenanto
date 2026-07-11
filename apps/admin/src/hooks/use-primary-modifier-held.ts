import { useEffect, useState } from "react";

import { isPrimaryModifierHeld } from "@/lib/primary-modifier-key";

export function usePrimaryModifierHeld(): boolean {
  const [isHeld, setIsHeld] = useState(false);

  useEffect(() => {
    const handleKeyEvent = (event: KeyboardEvent) => {
      setIsHeld(isPrimaryModifierHeld(event));
    };

    const handleBlur = () => {
      setIsHeld(false);
    };

    window.addEventListener("keydown", handleKeyEvent);
    window.addEventListener("keyup", handleKeyEvent);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyEvent);
      window.removeEventListener("keyup", handleKeyEvent);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  return isHeld;
}
