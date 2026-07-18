import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { type ReactNode } from "react";

import { queryClient } from "@/lib/query-client";
import { queryPersistOptions } from "@/lib/query-persist-config";

export function QueryPersistProvider({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={queryPersistOptions}>
      {children}
    </PersistQueryClientProvider>
  );
}
