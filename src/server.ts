import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createFacebookClient, type FacebookClient } from "./adapters/facebook/client.js";
import { registerGetListing } from "./tools/getListing.js";
import { registerPing } from "./tools/ping.js";

export const SERVER_NAME = "fb-marketplace-mcp";
export const SERVER_VERSION = "0.1.0";

export interface ServerDeps {
  fb: FacebookClient;
}

// Kept separate from the stdio entry point so tests can connect over an in-memory
// transport and inject a FacebookClient that replays fixtures.
export function createServer({ fb }: ServerDeps = { fb: createFacebookClient() }): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerPing(server);
  registerGetListing(server, fb);
  return server;
}
