import { useSyncExternalStore } from "react";

import {
  EMPTY_RECENT_PROPERTIES,
  type IRecentProperty,
  readRecentProperties,
  subscribeRecentProperties,
} from "@/lib/recent-properties-storage";

export function useRecentProperties(): IRecentProperty[] {
  return useSyncExternalStore(
    subscribeRecentProperties,
    readRecentProperties,
    () => EMPTY_RECENT_PROPERTIES
  );
}
