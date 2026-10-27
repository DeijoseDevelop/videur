import { afterAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { createVideur } from "@videur/core";
import { startMcpServer } from "../src/server";

const dir = mkdtempSync(join(tmpdir(), "videur-mcp-test-"));
const videur = createVideur({
  config: { dataDir: dir, templatesDir: join(dir, "templates"), webDist: join(dir, "dist") },
});
const input = new PassThrough();
const output = new PassThrough();
const chunks: string[] = [];
output.on("data", (chunk) => chunks.push(String(chunk)));
const mcp = startMcpServer(videur, { input, output });

function wait(ms = 120): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function responses(): Array<Record<string, unknown>> {
  return chunks
    .join("")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

afterAll(async () => {
  mcp.close();
  await videur.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("MCP stdio", () => {
  it("responde initialize y tools/list", async () => {
    input.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} })}\n`);
    input.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })}\n`);
    await wait(200);
    const list = responses();
    const init = list.find((item) => item.id === 1) as { result?: { protocolVersion?: string; serverInfo?: { name?: string } } };
    expect(init.result?.protocolVersion).toBeString();
    expect(init.result?.serverInfo?.name).toBe("videur");

    const tools = list.find((item) => item.id === 2) as { result?: { tools?: Array<{ name: string }> } };
    expect(tools.result?.tools?.some((tool) => tool.name === "videur_doctor")).toBe(true);
    expect(tools.result?.tools?.some((tool) => tool.name === "videur_render")).toBe(true);
  });

  it("ejecuta tools/call doctor", async () => {
    input.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "videur_doctor", arguments: {} },
      })}\n`,
    );
    await wait(300);
    const response = responses().find((item) => item.id === 3) as {
      result?: { content?: Array<{ text?: string }>; isError?: boolean };
    };
    expect(response.result?.isError).toBe(false);
    expect(response.result?.content?.[0]?.text).toContain("tools");
  });
});
