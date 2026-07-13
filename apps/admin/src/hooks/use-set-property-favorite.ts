import { type InfiniteData, useMutation, useQueryClient } from "@tanstack/react-query";

import { type IAdminPropertiesListQuery, propertiesApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { type IAdminPropertiesListResponse, type IProperty } from "@/packages/shared";

function updatePropertyFavoriteInListCache(
  data: InfiniteData<IAdminPropertiesListResponse>,
  propertyId: string,
  favorite: boolean
): InfiniteData<IAdminPropertiesListResponse> {
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((item) =>
        item.id === propertyId
          ? {
              ...item,
              favoritedAt: favorite ? (item.favoritedAt ?? new Date().toISOString()) : null,
              isFavorite: favorite,
            }
          : item
      ),
    })),
  };
}

export function useSetPropertyFavorite(listFilters: Omit<IAdminPropertiesListQuery, "cursor">) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.propertiesList(listFilters);

  return useMutation<
    { property: IProperty },
    Error,
    { favorite: boolean; propertyId: string },
    { previousData?: InfiniteData<IAdminPropertiesListResponse> }
  >({
    mutationFn: ({ favorite, propertyId }: { favorite: boolean; propertyId: string }) =>
      propertiesApi.setFavorite(propertyId, { favorite }),
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onMutate: async ({ favorite, propertyId }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData =
        queryClient.getQueryData<InfiniteData<IAdminPropertiesListResponse>>(queryKey);

      queryClient.setQueryData<InfiniteData<IAdminPropertiesListResponse>>(queryKey, (current) =>
        current ? updatePropertyFavoriteInListCache(current, propertyId, favorite) : current
      );

      return { previousData };
    },
    onSettled: (_data, _error, { propertyId }) => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.propertyDetail(propertyId) });
    },
  });
}
