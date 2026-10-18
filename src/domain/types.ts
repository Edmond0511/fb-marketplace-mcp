// Our own shapes for Marketplace data. Adapters map Facebook's wire format into these,
// so nothing outside src/adapters depends on how Facebook encodes a response.

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** A Marketplace city page. Search URLs are keyed by pageId, not coordinates. */
export interface Place {
  name: string;
  pageId: string;
  coordinates: Coordinates;
}

export interface Money {
  amount: number;
  /** ISO code. Search results omit it; only listing detail carries it. */
  currency: string | null;
  formatted: string;
}

export interface SellerRef {
  id: string;
  name: string;
}

export interface Listing {
  id: string;
  title: string;
  url: string;
  price: Money | null;
  /** Strikethrough price, set when the seller has dropped the price. */
  previousPrice: Money | null;
  photoUrl: string | null;
  createdAt: string | null;
  city: string | null;
  categoryId: string | null;
  deliveryTypes: string[];
  seller: SellerRef | null;
  /** False when Facebook marks the listing sold, pending, hidden, or not live. */
  available: boolean;
}

export interface ListingAttribute {
  name: string;
  label: string;
}

export interface ListingDetail {
  id: string;
  title: string;
  url: string;
  description: string | null;
  /** Condition label, e.g. "Used - like new". */
  condition: string | null;
  attributes: ListingAttribute[];
  price: Money | null;
  previousPrice: Money | null;
  createdAt: string | null;
  locationText: string | null;
  coordinates: Coordinates | null;
  photos: string[];
  deliveryTypes: string[];
  categoryId: string | null;
  available: boolean;
}

export type SortOrder =
  | "best_match"
  | "creation_time_descend"
  | "price_ascend"
  | "price_descend"
  | "distance_ascend";

export type ItemCondition = "new" | "used_like_new" | "used_good" | "used_fair";
