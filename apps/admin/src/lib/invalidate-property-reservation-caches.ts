import { type QueryClient } from "@tanstack/react-query";

export function invalidatePropertyReservationCaches(queryClient: QueryClient, propertyId: string) {
  queryClient.invalidateQueries({
    queryKey: ["property", propertyId, "short-stays"],
  });
}
