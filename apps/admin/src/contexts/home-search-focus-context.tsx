import { createContext, useContext } from "react";

interface IHomeSearchFocusContextValue {
  focusSearch: () => void;
  registerFocusHandler: (handler: (() => void) | null) => void;
}

export const HomeSearchFocusContext = createContext<IHomeSearchFocusContextValue | null>(null);

export function useHomeSearchFocus() {
  return useContext(HomeSearchFocusContext);
}
