import { type QueryClient } from "@tanstack/react-query";

export function invalidatePropertyReservationCaches(
  queryClient: QueryClient,
  propertyId: string
) {
  void queryClient.invalidateQueries({
    queryKey: ["property", propertyId, "reservations"],
  });
}
