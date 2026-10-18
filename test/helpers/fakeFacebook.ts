import { readFileSync } from "node:fs";
import { FacebookClient } from "../../src/adapters/facebook/client.js";
import { createFacebookHttp } from "../../src/adapters/facebook/http.js";
import type { Place } from "../../src/domain/types.js";
import { createRateLimiter } from "../../src/infra/rateLimiter.js";

export const fixture = (name: string) =>
  readFileSync(new URL(`../fixtures/facebook/${name}`, import.meta.url), "utf8");

export const WATERLOO: Place = {
  name: "Waterloo, Ontario",
  pageId: "112763262068685",
  coordinates: { latitude: 43.46522, longitude: -80.522317 },
};

export type Route = { status?: number; body: string };
export type Routes = { graphql?: Record<string, Route>; pages?: Record<string, Route> };

// A real FacebookClient whose fetch replays recorded responses: GraphQL by doc_id,
// pages by URL prefix. Any unrouted request fails, so tests never reach Facebook.
export function fakeFacebookClient(routes: Routes) {
  const calls: string[] = [];
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    let route: Route | undefined;
    if (init?.method === "POST") {
      const docId = new URLSearchParams(String(init.body)).get("doc_id") ?? "";
      calls.push(`graphql:${docId}`);
      route = routes.graphql?.[docId];
    } else {
      calls.push(`page:${url}`);
      route = Object.entries(routes.pages ?? {}).find(([prefix]) => url.startsWith(prefix))?.[1];
    }
    if (!route) throw new Error(`unrouted request: ${url}`);
    return new Response(route.body, { status: route.status ?? 200 });
  }) as typeof globalThis.fetch;
  const limiter = createRateLimiter({ minIntervalMs: 0, jitterMs: 0 });
  return { client: new FacebookClient(createFacebookHttp({ limiter, fetch })), calls };
}
