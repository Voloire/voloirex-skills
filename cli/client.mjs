export function makeClient(url, token, { fetchImpl = fetch, requestTimeoutMs = 30000 } = {}) {
  let sequence = 0;
  let protocolVersion;
  async function rpc(method, params, notification = false) {
    const payload = { jsonrpc: "2.0", method, ...(notification ? {} : { id: ++sequence }) };
    if (params !== undefined) payload.params = params;
    const headers = { "Content-Type": "application/json", Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}` };
    if (protocolVersion) headers["MCP-Protocol-Version"] = protocolVersion;
    const response = await fetchImpl(url, { method: "POST", headers, body: JSON.stringify(payload),
      signal: AbortSignal.timeout(requestTimeoutMs) });
    const text = await response.text();
    if (!response.ok) throw new Error(`MCP HTTP ${response.status}: ${text.slice(0, 300)}`);
    if (notification && (response.status === 202 || response.status === 204 || !text)) return;
    if (!text) throw new Error(`Empty response to ${method}`);
    let parsed;
    try { parsed = JSON.parse(text); } catch { throw new Error(`Invalid JSON response to ${method}`); }
    if (parsed.error) throw new Error(`${method}: ${parsed.error.message || "JSON-RPC error"}`);
    if (!Object.hasOwn(parsed, "result")) throw new Error(`Missing result for ${method}`);
    return parsed.result;
  }
  return {
    async handshake() {
      const result = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {},
        clientInfo: { name: "voloirex-cli", version: "0.2.0" } });
      if (!result?.protocolVersion) throw new Error("Invalid MCP initialization response");
      protocolVersion = result.protocolVersion;
      await rpc("notifications/initialized", undefined, true);
    },
    async call(name, args) {
      const result = await rpc("tools/call", { name, arguments: args });
      let value = result?.structuredContent;
      if (!value) {
        const text = result?.content?.find((part) => part.type === "text")?.text;
        try { value = JSON.parse(text); } catch { throw new Error(`Invalid tool output from ${name}`); }
      }
      if (result.isError || value.error) throw new Error(`${name}: ${value.error?.message || "Tool failed"}`);
      return value;
    },
  };
}

export async function waitForReport(client, jobId, { review = false, timeoutMs = 2400000,
  pollMs = 2000, now = Date.now, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  const deadline = now() + timeoutMs;
  for (;;) {
    if (now() >= deadline) throw new Error(`Timed out waiting for job ${jobId}; resume this job instead of starting another.`);
    const status = await client.call(review ? "review_status" : "status", { job_id: jobId });
    if (status.status === "failed") throw new Error(`Job ${jobId} failed; no report is available.`);
    if (["completed", "incomplete"].includes(status.status)) break;
    await sleep(Math.min(pollMs, Math.max(0, deadline - now())));
  }
  return client.call(review ? "get_report" : "report", { job_id: jobId, ...(review ? { format: "markdown" } : {}) });
}
