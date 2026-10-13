#!/usr/bin/env node
// Generic voloirex client. Drives any agent on the marketplace MCP endpoint.
//   node voloirex.mjs review "<architecture>" --profile C [--file f.md] [--evidence name=path ...]
//   node voloirex.mjs run <agent>
// Key: VOLOIREX_API_KEY, ASIMOX_API_KEY, or ~/.voloirex/config.json (and ~/.asimox/config.json).
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function readKey() {
  for (const k of ["VOLOIREX_API_KEY", "ASIMOX_API_KEY"]) if (process.env[k]) return process.env[k];
  for (const p of [join(homedir(), ".voloirex", "config.json"), join(homedir(), ".asimox", "config.json")]) {
    try {
      const cfg = JSON.parse(readFileSync(p, "utf8"));
      if (cfg.api_key) return cfg.api_key;
    } catch {}
  }
  return "";
}

function endpoint(agent = null) {
  const base = (process.env.VOLOIREX_ENDPOINT || "https://mcp.voloirex.com/mcp").replace(/\/+$/, "");
  return agent ? `${base}/${agent}` : base;
}

function makeClient(url, token) {
  let seq = 0;
  async function rpc(method, params, hasId = true) {
    const payload = { jsonrpc: "2.0", method };
    if (hasId) payload.id = ++seq;
    if (params !== undefined) payload.params = params;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (res.status === 202 || res.status === 204 || text === "") return { ok: true, notification: true };
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
    if (!res.ok) return { ok: false, status: res.status, error: parsed?.error?.message || parsed?.raw || text };
    return { ok: true, result: parsed.result, error: parsed.error };
  }
  function toolValue(result) {
    if (result?.structuredContent && Object.keys(result.structuredContent).length) return result.structuredContent;
    if (Array.isArray(result?.content)) {
      for (const c of result.content) {
        if (c.type === "text") { try { return JSON.parse(c.text); } catch { return { text: c.text }; } }
      }
    }
    return result ?? {};
  }
  async function call(name, args) {
    const r = await rpc("tools/call", { name, arguments: args });
    if (!r.ok) throw new Error(`${name}: ${r.error}`);
    if (r.notification) throw new Error(`${name}: unexpected empty response`);
    const v = toolValue(r.result);
    if (v?.error) throw new Error(`${name}: ${JSON.stringify(v.error)}`);
    return v;
  }
  async function handshake() {
    await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "voloirex-cli", version: "0.1.0" } });
    await rpc("notifications/initialized", undefined, false);
  }
  return { call, handshake };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function review(token, architecture, profile, evidence) {
  const c = makeClient(endpoint("asimox"), token);
  await c.handshake();
  const started = await c.call("start_review", { architecture, profile, evidence });
  const jobId = started.job_id;
  console.error(`job ${jobId} started (reserved ${started.reserved_credits} credits)`);
  for (;;) {
    await sleep(4000);
    const s = await c.call("review_status", { job_id: jobId });
    if (s.status === "completed" || s.status === "incomplete" || s.status === "failed") break;
  }
  const report = await c.call("get_report", { job_id: jobId, format: "markdown" });
  process.stdout.write(report.markdown || report.text || JSON.stringify(report, null, 2) + "\n");
}

async function runSimple(token, agent) {
  const c = makeClient(endpoint(agent), token);
  await c.handshake();
  const started = await c.call("run", {});
  const jobId = started.job_id;
  console.error(`job ${jobId} started (reserved ${started.reserved_credits} credits)`);
  for (;;) {
    await sleep(2000);
    const s = await c.call("status", { job_id: jobId });
    if (s.status === "completed" || s.status === "failed") break;
  }
  const r = await c.call("report", { job_id: jobId });
  process.stdout.write(r.text + "\n");
}

function parseEvidence(specs) {
  const out = [];
  for (const spec of specs) {
    for (const part of spec.split(" ")) {
      const [name, path] = part.split("=");
      if (!name || !path) throw new Error(`invalid evidence "${part}": use name=path`);
      out.push({ name, content: readFileSync(path, "utf8") });
    }
  }
  return out;
}

function usage() {
  console.error(
    "Usage:\n" +
    "  node voloirex.mjs review \"architecture\" --profile L|C|D|A [--file f.md] [--evidence name=path ...]\n" +
    "  node voloirex.mjs run <agent>",
  );
}

async function main() {
  const token = readKey();
  if (!token) { console.error("No key found. Set VOLOIREX_API_KEY or run the installer with -Key <token>."); process.exit(2); }
  const args = process.argv.slice(2);
  const cmd = args[0];
  const rest = args.slice(1);
  if (!cmd || cmd === "help") { usage(); return; }

  if (cmd === "review") {
    let profile = "C", architecture = null, file = null;
    const evidence = [];
    for (let i = 0; i < rest.length; i++) {
      const a = rest[i];
      if (a === "--profile") profile = rest[++i];
      else if (a === "--file") file = rest[++i];
      else if (a === "--evidence") evidence.push(...parseEvidence([rest[++i]]));
      else if (!architecture) architecture = a;
      else evidence.push(...parseEvidence([a]));
    }
    if (!architecture && file) architecture = readFileSync(file, "utf8");
    if (!architecture) { usage(); process.exit(2); }
    await review(token, architecture, profile, evidence);
    return;
  }

  if (cmd === "run") {
    const agent = rest[0];
    if (!agent) { usage(); process.exit(2); }
    await runSimple(token, agent);
    return;
  }

  usage();
  process.exit(2);
}

main().catch((e) => { console.error("voloirex error:", e.message); process.exit(1); });