import { describe, expect, it } from "vitest";
import { FacebookError } from "../../src/adapters/facebook/errors.js";
import {
  DETAIL_INFO_DOC_ID,
  DETAIL_PHOTOS_DOC_ID,
  LOCATION_DOC_ID,
  MARKETPLACE_HOME_URL,
  searchPageUrl,
} from "../../src/adapters/facebook/queries.js";
import { fakeFacebookClient as clientWith, fixture, WATERLOO } from "../helpers/fakeFacebook.js";

const searchRoute = (file: string) => ({
  pages: { "https://www.facebook.com/marketplace/112763262068685/search": { body: fixture(file) } },
});

async function expectFacebookError(promise: Promise<unknown>, code: FacebookError["code"]) {
  const err = await promise.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(FacebookError);
  expect((err as FacebookError).code).toBe(code);
}

describe("findPlace", () => {
  it("prefers the city node over higher-ranked venues", async () => {
    const { client } = clientWith({
      graphql: { [LOCATION_DOC_ID]: { body: fixture("location-waterloo-tests.json") } },
    });
    expect(await client.findPlace("Waterloo, Ontario")).toEqual(WATERLOO);
  });

  it("caches lookups regardless of case and spacing", async () => {
    const { client, calls } = clientWith({
      graphql: { [LOCATION_DOC_ID]: { body: fixture("location-waterloo-tests.json") } },
    });
    await client.findPlace("Waterloo, Ontario");
    await client.findPlace("  waterloo, ontario ");
    expect(calls).toHaveLength(1);
  });
});

describe("guessPlace", () => {
  it("reads the IP-guessed city from the Marketplace home page", async () => {
    const { client } = clientWith({
      pages: { [MARKETPLACE_HOME_URL]: { body: fixture("marketplace-home-tests.html") } },
    });
    expect(await client.guessPlace()).toEqual({
      name: "Toronto, Ontario",
      pageId: "110941395597405",
      coordinates: { latitude: 43.648, longitude: -79.3872 },
    });
  });
});

describe("search", () => {
  it("maps listings from the real feed and ignores empty shell payloads", async () => {
    const { client } = clientWith(searchRoute("search-page-tests.html"));
    const listings = await client.search({ query: "standing desk", place: WATERLOO });

    expect(listings).toHaveLength(15);
    expect(listings[0]).toEqual({
      id: "9000000000000001",
      title: "Standing desk",
      url: "https://www.facebook.com/marketplace/item/9000000000000001/",
      price: { amount: 110, currency: null, formatted: "CA$110" },
      previousPrice: null,
      photoUrl: "https://scontent.example.invalid/listing-1.jpg",
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      city: "Cambridge, Ontario",
      categoryId: "1583634935226685",
      deliveryTypes: ["IN_PERSON"],
      seller: { id: "pfbid-test-seller-1", name: "Test Seller 1" },
      available: true,
    });
  });

  it("returns what Facebook served for a filtered search", async () => {
    const { client } = clientWith(searchRoute("search-page-filtered-tests.html"));
    const listings = await client.search({
      query: "standing desk",
      place: WATERLOO,
      minPrice: 50,
      maxPrice: 150,
    });
    expect(listings.length).toBeGreaterThan(0);
    for (const l of listings) {
      expect(l.price?.amount).toBeGreaterThanOrEqual(50);
      expect(l.price?.amount).toBeLessThanOrEqual(150);
    }
  });

  it("returns an empty list when Facebook reports no results", async () => {
    const { client } = clientWith(searchRoute("search-page-no-results-tests.html"));
    expect(await client.search({ query: "zzqx", place: WATERLOO })).toEqual([]);
  });

  it("reports a login wall as blocked", async () => {
    const { client } = clientWith(searchRoute("login-wall-tests.html"));
    await expectFacebookError(client.search({ query: "desk", place: WATERLOO }), "blocked");
  });

  it("reports format_changed when listings no longer parse", async () => {
    const broken = fixture("search-page-tests.html").replaceAll(/"id":"9\d{15}",/g, "");
    const { client } = clientWith({
      pages: { "https://www.facebook.com/marketplace/": { body: broken } },
    });
    await expectFacebookError(client.search({ query: "desk", place: WATERLOO }), "format_changed");
  });

  it("serves a repeated search from cache", async () => {
    const { client, calls } = clientWith(searchRoute("search-page-tests.html"));
    await client.search({ query: "standing desk", place: WATERLOO });
    await client.search({ query: "standing desk", place: WATERLOO });
    expect(calls).toHaveLength(1);
  });
});

describe("getListing", () => {
  const detailRoutes = {
    graphql: {
      [DETAIL_INFO_DOC_ID]: { body: fixture("detail-info-tests.json") },
      [DETAIL_PHOTOS_DOC_ID]: { body: fixture("detail-photos-tests.json") },
    },
  };

  it("merges info and photos, tolerating partial field errors", async () => {
    const { client } = clientWith(detailRoutes);
    const detail = await client.getListing("9000000000000001");
    expect(detail).toMatchObject({
      id: "9000000000000001",
      title: "Standing desk",
      condition: "Used - like new",
      price: { amount: 110, currency: "CAD" },
      locationText: "Cambridge, ON",
      coordinates: { latitude: 43.34, longitude: -80.32 },
      available: true,
    });
    expect(detail.description).toContain("memory presets");
    expect(detail.photos).toHaveLength(4);
  });

  it("reports a missing target as not_found", async () => {
    const empty = JSON.stringify({
      data: { viewer: { marketplace_product_details_page: { target: null } } },
    });
    const { client } = clientWith({
      graphql: {
        [DETAIL_INFO_DOC_ID]: { body: empty },
        [DETAIL_PHOTOS_DOC_ID]: { body: empty },
      },
    });
    await expectFacebookError(client.getListing("1"), "not_found");
  });
});

describe("transport errors", () => {
  it.each([
    [429, "blocked"],
    [500, "request_failed"],
  ] as const)("maps HTTP %i to %s", async (status, code) => {
    const { client } = clientWith({
      graphql: { [LOCATION_DOC_ID]: { status, body: "" } },
    });
    await expectFacebookError(client.findPlace("Waterloo"), code);
  });

  it("treats a data-less GraphQL error as request_failed", async () => {
    const { client } = clientWith({
      graphql: { [LOCATION_DOC_ID]: { body: JSON.stringify({ errors: [{ message: "nope" }] }) } },
    });
    await expectFacebookError(client.findPlace("Waterloo"), "request_failed");
  });
});

describe("searchPageUrl", () => {
  it("encodes the web UI's filter parameters", () => {
    const url = new URL(
      searchPageUrl({
        query: "standing desk",
        place: WATERLOO,
        minPrice: 50,
        maxPrice: 150,
        radiusKm: 19.6,
        daysSinceListed: 7,
        sortBy: "creation_time_descend",
        condition: ["used_like_new", "used_good"],
      }),
    );
    expect(url.pathname).toBe("/marketplace/112763262068685/search");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      query: "standing desk",
      exact: "false",
      minPrice: "50",
      maxPrice: "150",
      radius: "20",
      daysSinceListed: "7",
      sortBy: "creation_time_descend",
      itemCondition: "used_like_new,used_good",
    });
  });
});
