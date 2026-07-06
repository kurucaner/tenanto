import { type QueryClient } from "@tanstack/react-query";

export function invalidatePropertyExpenseCaches(queryClient: QueryClient, propertyId: string) {
  void queryClient.invalidateQueries({
    queryKey: ["admin", "property", propertyId, "expenses"],
  });
}
