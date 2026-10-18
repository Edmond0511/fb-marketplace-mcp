import { describe, expect, it } from "vitest";
import { DETAIL_INFO_DOC_ID, DETAIL_PHOTOS_DOC_ID } from "../../src/adapters/facebook/queries.js";
import { createServer } from "../../src/server.js";
import { fakeFacebookClient, fixture, type Routes } from "../helpers/fakeFacebook.js";
import { connectClient, textOf } from "../helpers/mcpClient.js";

const detailRoutes: Routes = {
  graphql: {
    [DETAIL_INFO_DOC_ID]: { body: fixture("detail-info-tests.json") },
    [DETAIL_PHOTOS_DOC_ID]: { body: fixture("detail-photos-tests.json") },
  },
};

async function call(routes: Routes, args: Record<string, unknown>) {
  const client = await connectClient(createServer({ fb: fakeFacebookClient(routes).client }));
  const res = await client.callTool({ name: "get_listing", arguments: args });
  await client.close();
  return res;
}

describe("get_listing", () => {
  it("returns detail with seller-written text under untrusted", async () => {
    const res = await call(detailRoutes, { listingId: "9000000000000001" });
    expect(res.isError).toBeFalsy();
    const body = JSON.parse(textOf(res));
    expect(body).toMatchObject({
      id: "9000000000000001",
      condition: "Used - like new",
      price: { amount: 110, currency: "CAD" },
      untrusted: { title: "Standing desk" },
    });
    expect(body.untrusted.description).toContain("memory presets");
    expect(body.photos).toHaveLength(4);
    expect(body).not.toHaveProperty("title");
  });

  it("rejects ids that are not digits before calling Facebook", async () => {
    const res = await call({}, { listingId: "../../etc" });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toContain("digits only");
  });

  it("explains a Facebook error with a next step", async () => {
    const res = await call(
      { graphql: { [DETAIL_INFO_DOC_ID]: { status: 429, body: "" } } },
      { listingId: "1" },
    );
    expect(res.isError).toBe(true);
    expect(textOf(res)).toMatch(/^\[blocked\].*Wait several minutes/);
  });
});
