import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPing(server: McpServer): void {
  server.registerTool(
    "ping",
    {
      title: "Ping",
      description:
        "Health check. Echoes the message back so you can confirm the server is reachable.",
      inputSchema: { message: z.string().max(200).default("pong") },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ message }) => ({
      content: [{ type: "text", text: message }],
    }),
  );
}
