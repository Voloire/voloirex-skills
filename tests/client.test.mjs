import test from "node:test";
import assert from "node:assert/strict";
import { makeClient, waitForReport } from "../cli/client.mjs";

test("handshake validates result and uses negotiated protocol", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const request = JSON.parse(options.body);
    calls.push({ request, headers: options.headers });
    if (request.method === "initialize") return Response.json({ jsonrpc: "2.0", id: request.id,
      result: { protocolVersion: "2025-06-18" } });
    if (request.method === "notifications/initialized") return new Response(null, { status: 202 });
    return Response.json({ result: { structuredContent: { text: "Hello World, I'm asimoY" } } });
  };
  const client = makeClient("https://example.invalid", "dummy", { fetchImpl });
  await client.handshake();
  assert.equal((await client.call("report", {})).text, "Hello World, I'm asimoY");
  assert.equal(calls[2].headers["MCP-Protocol-Version"], "2025-06-18");
  assert.match(calls[0].headers.Accept, /application\/json/);
});

test("outer JSON-RPC initialization errors stop immediately", async () => {
  let calls = 0;
  const client = makeClient("https://example.invalid", "dummy", { fetchImpl: async () => {
    calls++;
    return Response.json({ error: { code: -32603, message: "initialization failed" } });
  } });
  await assert.rejects(client.handshake(), /initialization failed/);
  assert.equal(calls, 1);
});

test("tool errors are surfaced rather than treated as output", async () => {
  const client = makeClient("https://example.invalid", "dummy", { fetchImpl: async () =>
    Response.json({ result: { isError: true, structuredContent: { error: { message: "forbidden" } } } }) });
  await assert.rejects(client.call("run", {}), /forbidden/);
});

test("failed jobs do not attempt a report", async () => {
  const calls = [];
  const client = { call: async (name) => { calls.push(name); return { status: "failed" }; } };
  await assert.rejects(waitForReport(client, "job"), /failed/);
  assert.deepEqual(calls, ["status"]);
});

test("polling has a finite deadline and preserves job identity", async () => {
  let now = 0, calls = 0;
  const client = { call: async () => { calls++; return { status: "running" }; } };
  await assert.rejects(waitForReport(client, "existing-job", { timeoutMs: 10, pollMs: 5,
    now: () => now, sleep: async (ms) => { now += ms; } }), /resume this job/);
  assert.equal(calls, 2);
});
