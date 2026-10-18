import type { Listing, ListingDetail, Place } from "../../domain/types.js";
import { TtlCache } from "../../infra/cache.js";
import { createRateLimiter } from "../../infra/rateLimiter.js";
import { FacebookError } from "./errors.js";
import { jsonValuesForKey } from "./extract.js";
import { createFacebookHttp, type FacebookHttp } from "./http.js";
import {
  DETAIL_INFO_DOC_ID,
  DETAIL_PHOTOS_DOC_ID,
  detailInfoVariables,
  detailPhotosVariables,
  LOCATION_DOC_ID,
  locationVariables,
  MARKETPLACE_HOME_URL,
  type SearchPageQuery,
  searchPageUrl,
} from "./queries.js";
import {
  buyLocationCoordsWire,
  buyLocationNameWire,
  detailInfoWire,
  detailPhotosWire,
  feedUnitsWire,
  locationResponseWire,
  parseOrThrow,
  pickPlace,
  readFeedUnits,
  toGuessedPlace,
  toListingDetail,
} from "./schemas.js";

export type { SearchPageQuery } from "./queries.js";

// Fixed on purpose so nobody can tune their account into a ban.
const MIN_INTERVAL_MS = 2_000;
const JITTER_MS = 1_000;
const MINUTE = 60_000;

/** The only way the rest of the server reaches Facebook. Logged out only. */
export class FacebookClient {
  private readonly places = new TtlCache<Place | null>({ ttlMs: 60 * MINUTE, maxEntries: 200 });
  private readonly searches = new TtlCache<Listing[]>({ ttlMs: 5 * MINUTE, maxEntries: 200 });
  private readonly details = new TtlCache<ListingDetail>({ ttlMs: 15 * MINUTE, maxEntries: 500 });

  constructor(private readonly http: FacebookHttp) {}

  /** Resolves a place name ("Waterloo, Ontario") to a Marketplace city page. */
  findPlace(query: string): Promise<Place | null> {
    const key = query.trim().toLowerCase();
    return this.places.getOrLoad(`find:${key}`, async () => {
      const res = await this.http.graphql(LOCATION_DOC_ID, locationVariables(query));
      return pickPlace(parseOrThrow(locationResponseWire, res, "location search"));
    });
  }

  /** The city Facebook infers from this machine's IP. Coarse; confirm it with the user. */
  guessPlace(): Promise<Place | null> {
    return this.places.getOrLoad("guess", async () => {
      const html = await this.http.page(MARKETPLACE_HOME_URL);
      const name = firstMatching(jsonValuesForKey(html, "buy_location"), buyLocationNameWire);
      const coords = firstMatching(jsonValuesForKey(html, "buyLocation"), buyLocationCoordsWire);
      return name && coords ? toGuessedPlace(name, coords) : null;
    });
  }

  /** One page of results (about 15-24). Logged out, Facebook serves no further pages. */
  search(q: SearchPageQuery): Promise<Listing[]> {
    const url = searchPageUrl(q);
    return this.searches.getOrLoad(url, async () => {
      const html = await this.http.page(url);
      if (!html.includes('"marketplace_search"')) {
        throw new FacebookError("blocked", "Facebook served the search page without results data");
      }
      // The page embeds several feed_units payloads (shells, preloaders); the real one
      // is whichever carries the most listings, or an explicit no-results marker.
      let best: ReturnType<typeof readFeedUnits> | null = null;
      for (const value of jsonValuesForKey(html, "feed_units")) {
        const feed = feedUnitsWire.safeParse(value);
        if (!feed.success) continue;
        const reading = readFeedUnits(feed.data);
        const more = !best || reading.listings.length > best.listings.length;
        const tieWithMarker =
          best && reading.listings.length === best.listings.length && reading.noResults;
        if (more || tieWithMarker) best = reading;
      }
      if (!best || (best.listings.length === 0 && !best.noResults && best.invalid === 0)) {
        throw new FacebookError("format_changed", "Search page has no readable feed_units payload");
      }
      if (best.listings.length === 0 && best.invalid > 0) {
        throw new FacebookError(
          "format_changed",
          `Search returned ${best.invalid} listings, none in a shape we can read`,
        );
      }
      if (best.invalid > 0) console.error(`[facebook] skipped ${best.invalid} unreadable listings`);
      return best.listings;
    });
  }

  getListing(id: string): Promise<ListingDetail> {
    return this.details.getOrLoad(id, async () => {
      const [infoRes, photosRes] = await Promise.all([
        this.http.graphql(DETAIL_INFO_DOC_ID, detailInfoVariables(id)),
        this.http.graphql(DETAIL_PHOTOS_DOC_ID, detailPhotosVariables(id)),
      ]);
      const info = parseOrThrow(detailInfoWire, infoRes, "listing detail");
      const target = info.data.viewer.marketplace_product_details_page?.target;
      if (!target) throw new FacebookError("not_found", `Listing ${id} not found or removed`);
      return toListingDetail(target, parseOrThrow(detailPhotosWire, photosRes, "listing photos"));
    });
  }
}

export function createFacebookClient(fetch?: typeof globalThis.fetch): FacebookClient {
  const limiter = createRateLimiter({ minIntervalMs: MIN_INTERVAL_MS, jitterMs: JITTER_MS });
  return new FacebookClient(createFacebookHttp({ limiter, ...(fetch ? { fetch } : {}) }));
}

function firstMatching<T>(
  values: Iterable<unknown>,
  schema: { safeParse(v: unknown): { success: true; data: T } | { success: false } },
): T | null {
  for (const value of values) {
    const parsed = schema.safeParse(value);
    if (parsed.success) return parsed.data;
  }
  return null;
}
