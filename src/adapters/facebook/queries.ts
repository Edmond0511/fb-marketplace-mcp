import type { ItemCondition, Place, SortOrder } from "../../domain/types.js";

// Persisted query ids from Facebook's web client. They change without notice;
// when one stops working, `npm run smoke` reports it and the id needs re-capturing.
export const LOCATION_DOC_ID = "5585904654783609";
export const DETAIL_INFO_DOC_ID = "26090240497332612";
export const DETAIL_PHOTOS_DOC_ID = "10059604367394414";

export const GRAPHQL_URL = "https://www.facebook.com/api/graphql/";
export const MARKETPLACE_HOME_URL = "https://www.facebook.com/marketplace/";

export interface SearchPageQuery {
  query: string;
  place: Place;
  minPrice?: number;
  maxPrice?: number;
  /** A hint only: Facebook pads results with listings well outside it. */
  radiusKm?: number;
  daysSinceListed?: 1 | 7 | 30;
  sortBy?: SortOrder;
  condition?: ItemCondition[];
}

// The logged-out GraphQL search is gated (it returns no edges), so search reads the
// server-rendered search page instead. Its URL parameters are the web UI's filters.
export function searchPageUrl(q: SearchPageQuery): string {
  const params = new URLSearchParams({ query: q.query, exact: "false" });
  if (q.minPrice !== undefined) params.set("minPrice", String(q.minPrice));
  if (q.maxPrice !== undefined) params.set("maxPrice", String(q.maxPrice));
  if (q.radiusKm !== undefined) params.set("radius", String(Math.round(q.radiusKm)));
  if (q.daysSinceListed !== undefined) params.set("daysSinceListed", String(q.daysSinceListed));
  if (q.sortBy !== undefined) params.set("sortBy", q.sortBy);
  if (q.condition?.length) params.set("itemCondition", q.condition.join(","));
  return `https://www.facebook.com/marketplace/${encodeURIComponent(q.place.pageId)}/search?${params}`;
}

export function locationVariables(query: string) {
  return {
    params: {
      caller: "MARKETPLACE",
      page_category: ["CITY", "SUBCITY", "NEIGHBORHOOD", "POSTAL_CODE"],
      query,
    },
  };
}

export function detailPhotosVariables(listingId: string) {
  return { targetId: listingId };
}

// Facebook's client sends every flag below; dropping them returns empty targets.
export function detailInfoVariables(listingId: string) {
  return {
    targetId: listingId,
    scale: 2,
    feedbackSource: 56,
    feedLocation: "MARKETPLACE_MEGAMALL",
    referralCode: "marketplace_top_picks",
    enableJobEmployerActionBar: false,
    enableJobSeekerActionBar: false,
    useDefaultActor: false,
    __relay_internal__pv__CometUFICommentActionLinksRewriteEnabledrelayprovider: false,
    __relay_internal__pv__CometUFICommentAvatarStickerAnimatedImagerelayprovider: false,
    __relay_internal__pv__CometUFIReactionsEnableShortNamerelayprovider: false,
    __relay_internal__pv__CometUFIShareActionMigrationrelayprovider: true,
    __relay_internal__pv__CometUFI_dedicated_comment_routable_dialog_gkrelayprovider: false,
    __relay_internal__pv__GHLShouldChangeAdIdFieldNamerelayprovider: true,
    __relay_internal__pv__GHLShouldChangeSponsoredDataFieldNamerelayprovider: true,
    __relay_internal__pv__IsWorkUserrelayprovider: false,
    __relay_internal__pv__ShouldUpdateMarketplaceBoostListingBoostedStatusrelayprovider: false,
  };
}
