import {
  buildPropertyRow,
  FAVORITE_NEW_ID,
  FAVORITE_OLD_ID,
  UNFAVORITE_NEW_ID,
  UNFAVORITE_OLD_ID,
} from "../db-rows/property-row";

export const PROPERTIES_PAGINATION_USER_ID = "22222222-2222-4222-8222-222222222222";

export const propertiesPaginationSortedRows = [
  buildPropertyRow({
    createdAt: "2026-07-09T10:00:00.000Z",
    favoritedAt: new Date("2026-07-01T12:00:00.000Z"),
    id: FAVORITE_OLD_ID,
    name: "Favorite Old",
    userId: PROPERTIES_PAGINATION_USER_ID,
  }),
  buildPropertyRow({
    createdAt: "2026-07-08T10:00:00.000Z",
    favoritedAt: new Date("2026-07-05T12:00:00.000Z"),
    id: FAVORITE_NEW_ID,
    name: "Favorite New",
    userId: PROPERTIES_PAGINATION_USER_ID,
  }),
  buildPropertyRow({
    createdAt: "2026-07-09T10:00:00.000Z",
    favoritedAt: null,
    id: UNFAVORITE_NEW_ID,
    name: "Unfavorite New",
    userId: PROPERTIES_PAGINATION_USER_ID,
  }),
  buildPropertyRow({
    createdAt: "2026-07-07T10:00:00.000Z",
    favoritedAt: null,
    id: UNFAVORITE_OLD_ID,
    name: "Unfavorite Old",
    userId: PROPERTIES_PAGINATION_USER_ID,
  }),
];

export {
  FAVORITE_NEW_ID,
  FAVORITE_OLD_ID,
  UNFAVORITE_NEW_ID,
  UNFAVORITE_OLD_ID,
} from "../db-rows/property-row";
