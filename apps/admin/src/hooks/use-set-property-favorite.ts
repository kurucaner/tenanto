import { type InfiniteData, useMutation, useQueryClient } from "@tanstack/react-query";

import { type IAdminPropertiesListQuery, propertiesApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { type IAdminPropertiesListResponse, type IProperty } from "@/packages/shared";

function applyPropertyFavorite(item: IProperty, favorite: boolean): IProperty {
  return {
    ...item,
    favoritedAt: favorite ? (item.favoritedAt ?? new Date().toISOString()) : null,
    isFavorite: favorite,
  };
}

function updatePropertyFavoriteInListResponse(
  data: IAdminPropertiesListResponse,
  propertyId: string,
  favorite: boolean
): IAdminPropertiesListResponse {
  return {
    ...data,
    items: data.items.map((item) =>
      item.id === propertyId ? applyPropertyFavorite(item, favorite) : item
    ),
  };
}

function updatePropertyFavoriteInListCache(
  data: InfiniteData<IAdminPropertiesListResponse>,
  propertyId: string,
  favorite: boolean
): InfiniteData<IAdminPropertiesListResponse> {
  return {
    ...data,
    pages: data.pages.map((page) =>
      updatePropertyFavoriteInListResponse(page, propertyId, favorite)
    ),
  };
}

export function useSetPropertyFavorite(listFilters: Omit<IAdminPropertiesListQuery, "cursor">) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.propertiesList(listFilters);
  const homeWorkspaceQueryKey = queryKeys.homeWorkspace();

  return useMutation<
    { property: IProperty },
    Error,
    { favorite: boolean; propertyId: string },
    {
      previousHomeWorkspaceData?: IAdminPropertiesListResponse;
      previousInfiniteData?: InfiniteData<IAdminPropertiesListResponse>;
    }
  >({
    mutationFn: ({ favorite, propertyId }: { favorite: boolean; propertyId: string }) =>
      propertiesApi.setFavorite(propertyId, { favorite }),
    onError: (_error, _variables, context) => {
      if (context?.previousInfiniteData) {
        queryClient.setQueryData(queryKey, context.previousInfiniteData);
      }
      if (context?.previousHomeWorkspaceData) {
        queryClient.setQueryData(homeWorkspaceQueryKey, context.previousHomeWorkspaceData);
      }
    },
    onMutate: async ({ favorite, propertyId }) => {
      await queryClient.cancelQueries({ queryKey });
      await queryClient.cancelQueries({ queryKey: homeWorkspaceQueryKey });

      const previousInfiniteData =
        queryClient.getQueryData<InfiniteData<IAdminPropertiesListResponse>>(queryKey);
      const previousHomeWorkspaceData =
        queryClient.getQueryData<IAdminPropertiesListResponse>(homeWorkspaceQueryKey);

      queryClient.setQueryData<InfiniteData<IAdminPropertiesListResponse>>(queryKey, (current) =>
        current ? updatePropertyFavoriteInListCache(current, propertyId, favorite) : current
      );
      queryClient.setQueryData<IAdminPropertiesListResponse>(homeWorkspaceQueryKey, (current) =>
        current ? updatePropertyFavoriteInListResponse(current, propertyId, favorite) : current
      );

      return { previousHomeWorkspaceData, previousInfiniteData };
    },
    onSettled: (_data, _error, { propertyId }) => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: homeWorkspaceQueryKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.propertyDetail(propertyId) });
    },
  });
}
