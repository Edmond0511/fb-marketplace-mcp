import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "../../src/server.js";

describe("ping", () => {
  let client: Client;

  beforeEach(async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await createServer().connect(serverTransport);
    client = new Client({ name: "test", version: "0.0.0" });
    await client.connect(clientTransport);
  });

  afterEach(() => client.close());

  it("is listed with its schema", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain("ping");
  });

  it("echoes the message", async () => {
    const res = await client.callTool({ name: "ping", arguments: { message: "hi" } });
    expect(res.content).toEqual([{ type: "text", text: "hi" }]);
  });

  it("rejects input that fails the schema", async () => {
    const res = await client.callTool({ name: "ping", arguments: { message: "x".repeat(201) } });
    expect(res.isError).toBe(true);
  });
});
