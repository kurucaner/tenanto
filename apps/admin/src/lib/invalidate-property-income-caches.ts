import { type QueryClient } from "@tanstack/react-query";

export function invalidatePropertyIncomeCaches(queryClient: QueryClient, propertyId: string) {
  void queryClient.invalidateQueries({
    queryKey: ["property", propertyId, "income-lines"],
  });
  void queryClient.invalidateQueries({
    queryKey: ["property", propertyId, "reservations"],
  });
}
