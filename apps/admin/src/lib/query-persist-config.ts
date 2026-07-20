import "@/lib/query-meta";

import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { type Query } from "@tanstack/react-query";
import { type PersistQueryClientOptions } from "@tanstack/react-query-persist-client";

import { APP_SLUG } from "@/packages/shared";

export const QUERY_PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const QUERY_PERSIST_STORAGE_KEY = `${APP_SLUG}-admin-query-cache`;

export const queryPersistPersister = createAsyncStoragePersister({
  key: QUERY_PERSIST_STORAGE_KEY,
  storage: window.localStorage,
});

export function shouldPersistQuery(query: Query): boolean {
  return query.state.status === "success" && query.meta?.persist === true;
}

export const queryPersistOptions: Omit<PersistQueryClientOptions, "queryClient"> = {
  dehydrateOptions: {
    shouldDehydrateMutation: () => false,
    shouldDehydrateQuery: shouldPersistQuery,
  },
  maxAge: QUERY_PERSIST_MAX_AGE_MS,
  persister: queryPersistPersister,
};

export function removePersistedQueryCache(): Promise<void> {
  return Promise.resolve(queryPersistPersister.removeClient());
}
