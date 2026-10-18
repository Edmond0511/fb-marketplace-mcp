import { z } from "zod";
import type { Coordinates, Listing, ListingDetail, Money, Place } from "../../domain/types.js";
import { FacebookError } from "./errors.js";

// Wire schemas for the parts of Facebook's responses we read. Unknown keys are
// stripped; fields are nullish unless a record is useless without them.

const coordinatesWire = z.object({ latitude: z.number(), longitude: z.number() });

const moneyWire = z
  .object({
    formatted_amount: z.string().nullish(),
    formatted_amount_zeros_stripped: z.string().nullish(),
    amount: z.string().nullish(),
    currency: z.string().nullish(),
  })
  .nullish();

const listingStatusWire = {
  is_sold: z.boolean().nullish(),
  is_live: z.boolean().nullish(),
  is_pending: z.boolean().nullish(),
  is_hidden: z.boolean().nullish(),
};

const feedListingWire = z.object({
  id: z.string(),
  marketplace_listing_title: z.string().nullish(),
  listing_price: moneyWire,
  strikethrough_price: moneyWire,
  primary_listing_photo: z.object({ image: z.object({ uri: z.string() }).nullish() }).nullish(),
  creation_time: z.number().nullish(),
  location: z
    .object({
      reverse_geocode: z
        .object({
          city: z.string().nullish(),
          state: z.string().nullish(),
          city_page: z.object({ display_name: z.string().nullish() }).nullish(),
        })
        .nullish(),
    })
    .nullish(),
  marketplace_listing_category_id: z.string().nullish(),
  delivery_types: z.array(z.string()).nullish(),
  marketplace_listing_seller: z.object({ id: z.string(), name: z.string() }).nullish(),
  ...listingStatusWire,
});

const feedEdgeWire = z
  .object({
    node: z.object({ __typename: z.string().nullish(), listing: z.unknown().optional() }).nullish(),
  })
  .nullish();

export const feedUnitsWire = z.object({ edges: z.array(feedEdgeWire) });

const NO_RESULTS_TYPENAME = "MarketplaceSearchFeedNoResults";

/** A feed_units payload from the search page, mapped to listings. */
export interface FeedReading {
  listings: Listing[];
  /** Edges that carried a listing we could not parse. */
  invalid: number;
  /** Facebook explicitly said there are no results. */
  noResults: boolean;
}

export function readFeedUnits(feed: z.infer<typeof feedUnitsWire>): FeedReading {
  const listings: Listing[] = [];
  let invalid = 0;
  let noResults = false;
  for (const edge of feed.edges) {
    if (edge?.node?.__typename === NO_RESULTS_TYPENAME) noResults = true;
    if (edge?.node?.listing == null) continue;
    const parsed = feedListingWire.safeParse(edge.node.listing);
    if (parsed.success) listings.push(toListing(parsed.data));
    else invalid++;
  }
  return { listings, invalid, noResults };
}

function toListing(w: z.infer<typeof feedListingWire>): Listing {
  const geo = w.location?.reverse_geocode;
  return {
    id: w.id,
    title: w.marketplace_listing_title ?? "",
    url: listingUrl(w.id),
    price: toMoney(w.listing_price),
    previousPrice: toMoney(w.strikethrough_price),
    photoUrl: w.primary_listing_photo?.image?.uri ?? null,
    createdAt: toIso(w.creation_time),
    city:
      geo?.city_page?.display_name ?? ([geo?.city, geo?.state].filter(Boolean).join(", ") || null),
    categoryId: w.marketplace_listing_category_id ?? null,
    deliveryTypes: w.delivery_types ?? [],
    seller: w.marketplace_listing_seller ?? null,
    available: isAvailable(w),
  };
}

const placeNodeWire = z.object({
  single_line_address: z.string().nullish(),
  subtitle: z.string().nullish(),
  page: z.object({ id: z.string() }).nullish(),
  location: coordinatesWire.nullish(),
});

export const locationResponseWire = z.object({
  data: z.object({
    city_street_search: z.object({
      street_results: z.object({
        edges: z.array(z.object({ node: placeNodeWire.nullish() }).nullish()),
      }),
    }),
  }),
});

// Results rank by check-ins, so a venue can outrank the city; prefer real city nodes.
export function pickPlace(res: z.infer<typeof locationResponseWire>): Place | null {
  const candidates = res.data.city_street_search.street_results.edges.flatMap((edge) => {
    const node = edge?.node;
    if (!node?.page?.id || !node.location || !node.single_line_address) return [];
    const place: Place = {
      name: node.single_line_address,
      pageId: node.page.id,
      coordinates: node.location,
    };
    return [{ place, isCity: node.subtitle?.split(" ·")[0] === "City" }];
  });
  return (candidates.find((c) => c.isCity) ?? candidates[0])?.place ?? null;
}

const detailTargetWire = z.object({
  id: z.string(),
  marketplace_listing_title: z.string().nullish(),
  redacted_description: z.object({ text: z.string().nullish() }).nullish(),
  attribute_data: z
    .array(z.object({ attribute_name: z.string(), label: z.string().nullish() }))
    .nullish(),
  listing_price: moneyWire,
  strikethrough_price: moneyWire,
  creation_time: z.number().nullish(),
  location_text: z.object({ text: z.string().nullish() }).nullish(),
  location: coordinatesWire.nullish(),
  delivery_types: z.array(z.string()).nullish(),
  marketplace_listing_category_id: z.string().nullish(),
  ...listingStatusWire,
});

const detailEnvelope = <T extends z.ZodType>(target: T) =>
  z.object({
    data: z.object({
      viewer: z.object({
        marketplace_product_details_page: z.object({ target: target.nullish() }).nullish(),
      }),
    }),
  });

export const detailInfoWire = detailEnvelope(detailTargetWire);

export const detailPhotosWire = detailEnvelope(
  z.object({
    listing_photos: z
      .array(z.object({ image: z.object({ uri: z.string() }).nullish() }).nullish())
      .nullish(),
  }),
);

export function toListingDetail(
  info: z.infer<typeof detailTargetWire>,
  photos: z.infer<typeof detailPhotosWire>,
): ListingDetail {
  const photoTarget = photos.data.viewer.marketplace_product_details_page?.target;
  const attributes = (info.attribute_data ?? []).map((a) => ({
    name: a.attribute_name,
    label: a.label ?? "",
  }));
  return {
    id: info.id,
    title: info.marketplace_listing_title ?? "",
    url: listingUrl(info.id),
    description: info.redacted_description?.text ?? null,
    condition: attributes.find((a) => a.name === "Condition")?.label ?? null,
    attributes,
    price: toMoney(info.listing_price),
    previousPrice: toMoney(info.strikethrough_price),
    createdAt: toIso(info.creation_time),
    locationText: info.location_text?.text ?? null,
    coordinates: info.location ?? null,
    photos: (photoTarget?.listing_photos ?? []).flatMap((p) =>
      p?.image?.uri ? [p.image.uri] : [],
    ),
    deliveryTypes: info.delivery_types ?? [],
    categoryId: info.marketplace_listing_category_id ?? null,
    available: isAvailable(info),
  };
}

// The home page names the city Facebook guessed from the caller's IP.
export const buyLocationNameWire = z.object({ display_name: z.string(), id: z.string() });
export const buyLocationCoordsWire = coordinatesWire;

export function toGuessedPlace(
  name: z.infer<typeof buyLocationNameWire>,
  coordinates: Coordinates,
): Place {
  return { name: name.display_name, pageId: name.id, coordinates };
}

export function parseOrThrow<T extends z.ZodType>(schema: T, value: unknown, what: string) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new FacebookError(
      "format_changed",
      `Facebook's ${what} response no longer matches the expected shape: ${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data as z.infer<T>;
}

function toMoney(w: z.infer<typeof moneyWire>): Money | null {
  const amount = w?.amount == null ? Number.NaN : Number(w.amount);
  if (!w || Number.isNaN(amount)) return null;
  return {
    amount,
    currency: w.currency ?? null,
    formatted: w.formatted_amount ?? w.formatted_amount_zeros_stripped ?? String(amount),
  };
}

function toIso(epochSeconds: number | null | undefined): string | null {
  return epochSeconds == null ? null : new Date(epochSeconds * 1000).toISOString();
}

function isAvailable(w: {
  is_sold?: boolean | null | undefined;
  is_live?: boolean | null | undefined;
  is_pending?: boolean | null | undefined;
  is_hidden?: boolean | null | undefined;
}): boolean {
  return !w.is_sold && !w.is_pending && !w.is_hidden && w.is_live !== false;
}

function listingUrl(id: string): string {
  return `https://www.facebook.com/marketplace/item/${id}/`;
}
