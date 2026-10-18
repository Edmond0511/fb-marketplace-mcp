import type { RateLimiter } from "../../infra/rateLimiter.js";
import { FacebookError } from "./errors.js";
import { GRAPHQL_URL } from "./queries.js";

export interface FacebookHttp {
  /** Returns the parsed body; callers validate its shape. */
  graphql(docId: string, variables: object): Promise<unknown>;
  page(url: string): Promise<string>;
}

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const GRAPHQL_HEADERS = {
  "content-type": "application/x-www-form-urlencoded",
  "sec-fetch-site": "same-origin",
  "user-agent": USER_AGENT,
};

// The search page only renders results for navigation-shaped requests.
const PAGE_HEADERS = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "sec-fetch-user": "?1",
  "upgrade-insecure-requests": "1",
  "user-agent": USER_AGENT,
};

export interface FacebookHttpOptions {
  limiter: RateLimiter;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

export function createFacebookHttp({
  limiter,
  fetch = globalThis.fetch,
  timeoutMs = 10_000,
}: FacebookHttpOptions): FacebookHttp {
  async function send(url: string, init: RequestInit): Promise<Response> {
    let res: Response;
    try {
      res = await limiter.schedule(() =>
        fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }),
      );
    } catch (cause) {
      throw new FacebookError("request_failed", `Request to Facebook failed: ${String(cause)}`, {
        cause,
      });
    }
    if (res.status === 429)
      throw new FacebookError("blocked", "Facebook is rate limiting requests");
    if (!res.ok) throw new FacebookError("request_failed", `Facebook returned HTTP ${res.status}`);
    return res;
  }

  return {
    async graphql(docId, variables) {
      const body = new URLSearchParams({ doc_id: docId, variables: JSON.stringify(variables) });
      const res = await send(GRAPHQL_URL, { method: "POST", headers: GRAPHQL_HEADERS, body });
      let json: { data?: unknown; errors?: { message?: string }[] };
      try {
        json = await res.json();
      } catch (cause) {
        throw new FacebookError("format_changed", "Facebook GraphQL returned non-JSON", { cause });
      }
      // Partial field errors arrive alongside usable data; only a data-less reply is a failure.
      if (json.errors?.length && !json.data) {
        throw new FacebookError(
          "request_failed",
          `Facebook GraphQL error: ${json.errors[0]?.message ?? "unknown"}`,
        );
      }
      return json;
    },

    async page(url) {
      const res = await send(url, { headers: PAGE_HEADERS });
      return res.text();
    },
  };
}
