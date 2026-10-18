import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "../../src/server.js";
import { fakeFacebookClient } from "../helpers/fakeFacebook.js";
import { connectClient } from "../helpers/mcpClient.js";

describe("ping", () => {
  let client: Client;

  beforeEach(async () => {
    client = await connectClient(createServer({ fb: fakeFacebookClient({}).client }));
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
