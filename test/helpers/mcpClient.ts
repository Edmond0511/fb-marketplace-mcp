import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/** Connects a real MCP client to the server, so tests go through the protocol. */
export async function connectClient(server: McpServer): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(clientTransport);
  return client;
}

/** The first text block of a tool result. */
export function textOf(result: Awaited<ReturnType<Client["callTool"]>>): string {
  const block = (result.content as { type: string; text?: string }[])[0];
  return block?.text ?? "";
}
