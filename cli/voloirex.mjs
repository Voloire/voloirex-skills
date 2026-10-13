#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { makeClient, waitForReport } from "./client.mjs";

function readKey() {
  const env = process.env.VOLOIREX_API_KEY || process.env.ASIMOX_API_KEY;
  if (env) return env;
  for (const dir of [".voloirex", ".asimox"]) {
    try {
      const value = JSON.parse(readFileSync(join(homedir(), dir, "config.json"), "utf8")).api_key;
      if (value) return value;
    } catch {}
  }
  throw new Error("No marketplace key found. Run the dashboard installer or set VOLOIREX_API_KEY.");
}

function usage() {
  console.log(`Usage:
  node voloirex.mjs review "architecture" --profile C [--file design.md] [--evidence name=path]
  node voloirex.mjs run <agent> [--request-id ID]
  node voloirex.mjs resume <agent> <job-id> [--review]
  All commands accept --timeout-seconds N. Reuse a request ID only with identical inputs.`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || ["help", "--help", "-h"].includes(command)) return usage();
  if (!["review", "run", "resume"].includes(command)) throw new Error("Unknown command; use --help.");
  let agent = command === "review" ? "asimox" : args.shift();
  let jobId = command === "resume" ? args.shift() : null;
  let isReview = command === "review" || agent === "asimox";
  let architecture, file, profile = "C", requestId = randomUUID(), timeoutSeconds = 2400;
  const evidence = [];
  for (let i = 0; i < args.length; i++) {
    const option = args[i];
    if (option === "--review") { isReview = true; continue; }
    if (["--profile", "--file", "--request-id", "--timeout-seconds", "--evidence", "--agent"].includes(option)) {
      const value = args[++i];
      if (value === undefined || value.startsWith("--")) throw new Error(`Missing value for ${option}`);
      if (option === "--profile") profile = value;
      if (option === "--file") file = value;
      if (option === "--agent") agent = value;
      if (option === "--request-id") requestId = value;
      if (option === "--timeout-seconds") timeoutSeconds = Number(value);
      if (option === "--evidence") {
        const separator = value.indexOf("=");
        if (separator <= 0 || separator === value.length - 1) throw new Error("Evidence must use name=path.");
        evidence.push({ name: value.slice(0, separator), content: readFileSync(value.slice(separator + 1), "utf8") });
      }
    } else if (command === "review" && !architecture && !option.startsWith("--")) architecture = option;
    else throw new Error(`Unexpected argument: ${option}`);
  }
  if (!/^[a-z][a-z0-9-]{1,30}$/.test(agent || "")) throw new Error("Invalid agent identifier.");
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0 || timeoutSeconds > 86400) throw new Error("Invalid timeout.");
  if (!requestId || requestId.length > 128) throw new Error("Invalid request ID.");
  if (command === "resume" && !/^[0-9a-f]{32}$/.test(jobId || "")) throw new Error("Invalid job ID.");
  if (command === "review") {
    if (file) architecture = readFileSync(file, "utf8");
    if (!architecture?.trim() || !["L", "C", "D", "A"].includes(profile)) throw new Error("A review requires architecture text and profile L/C/D/A.");
  }
  const base = new URL((process.env.VOLOIREX_ENDPOINT || "https://mcp.voloirex.com/mcp").replace(/\/+$/, "") + "/");
  if (base.username || base.password || (base.protocol !== "https:" &&
      !(base.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)))) {
    throw new Error("The endpoint must use HTTPS, or localhost for development.");
  }
  const client = makeClient(new URL(agent, base).href, readKey());
  await client.handshake();
  if (command !== "resume") {
    console.error(`request ID: ${requestId}; reuse --request-id ${requestId} with identical inputs on retries`);
    const started = await client.call(isReview ? "start_review" : "run", {
      ...(isReview ? { architecture, profile, evidence } : {}), request_id: requestId,
    });
    jobId = started.job_id;
    console.error(`job ${jobId}; resume with: node voloirex.mjs resume ${agent} ${jobId}${isReview ? " --review" : ""}`);
  }
  const report = await waitForReport(client, jobId, { review: isReview, timeoutMs: timeoutSeconds * 1000 });
  process.stdout.write((report.markdown || report.text || JSON.stringify(report, null, 2)) + "\n");
}

main().catch((error) => { console.error(`voloirex error: ${error.message}`); process.exitCode = 1; });
