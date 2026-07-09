import { type QueryClient } from "@tanstack/react-query";

export function invalidatePropertyIncomeCaches(queryClient: QueryClient, propertyId: string) {
  queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) &&
      query.queryKey[1] === "property" &&
      query.queryKey[2] === propertyId &&
      (query.queryKey[3] === "reservations" || query.queryKey[3] === "income-lines"),
  });
}
