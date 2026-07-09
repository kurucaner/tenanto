import { type QueryClient } from "@tanstack/react-query";

export function invalidatePropertyExpenseCaches(queryClient: QueryClient, propertyId: string) {
  queryClient.invalidateQueries({
    queryKey: ["property", propertyId, "expenses"],
  });
}
