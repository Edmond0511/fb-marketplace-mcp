import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPing } from "./tools/ping.js";

export const SERVER_NAME = "fb-marketplace-mcp";
export const SERVER_VERSION = "0.1.0";

// Kept separate from the stdio entry point so tests can connect over an in-memory transport.
export function createServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerPing(server);
  return server;
}
