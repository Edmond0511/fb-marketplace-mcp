import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FacebookClient } from "../adapters/facebook/client.js";
import { facebookErrorResult, jsonResult, UNTRUSTED_NOTE } from "./shared.js";

export function registerGetListing(server: McpServer, fb: FacebookClient): void {
  server.registerTool(
    "get_listing",
    {
      title: "Get listing",
      description:
        "Full detail for one Facebook Marketplace listing: description, condition, all photos, " +
        `price, pickup location, and delivery options. Use it to inspect a search result. ${UNTRUSTED_NOTE}`,
      inputSchema: {
        listingId: z
          .string()
          .regex(/^\d{1,20}$/, "Listing ids are digits only, e.g. from a listing URL /item/<id>/"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ listingId }) => {
      try {
        const d = await fb.getListing(listingId);
        return jsonResult({
          id: d.id,
          url: d.url,
          available: d.available,
          price: d.price,
          previousPrice: d.previousPrice,
          condition: d.condition,
          createdAt: d.createdAt,
          locationText: d.locationText,
          coordinates: d.coordinates,
          deliveryTypes: d.deliveryTypes,
          photos: d.photos,
          untrusted: { title: d.title, description: d.description, attributes: d.attributes },
        });
      } catch (err) {
        return facebookErrorResult(err);
      }
    },
  );
}
