import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const source = fileURLToPath(new URL("../", import.meta.url));
const key = `vx_${"a".repeat(16)}_${"b".repeat(52)}`;

function install(home, token) {
  if (process.platform === "win32") return spawnSync("powershell.exe", ["-NoProfile", "-File",
    join(source, "install/install.ps1"), "-InstallHome", home, "-SourceDirectory", source,
    ...(token ? ["-Key", token] : [])], { encoding: "utf8" });
  return spawnSync("bash", [join(source, "install/install.sh")], { encoding: "utf8", env: {
    ...process.env, VOLOIREX_HOME: home, VOLOIREX_SOURCE_DIR: source,
    VOLOIREX_API_KEY: token, ASIMOX_API_KEY: "",
  } });
}

test("offline installer installs client and all Claude/Codex skills, preserving key on reinstall", () => {
  const home = mkdtempSync(join(process.env.VOLOIREX_TEST_ROOT || tmpdir(), "voloirex install test "));
  try {
    const first = install(home, key);
    assert.equal(first.status, 0, first.stderr || first.stdout);
    assert.equal(JSON.parse(readFileSync(join(home, ".voloirex/config.json"), "utf8")).api_key, key);
    for (const agent of ["asimox", "asimoy", "asimoz"]) {
      for (const client of [".claude", ".codex"]) {
        const path = join(home, client, "skills", agent);
        assert.ok(existsSync(join(path, "SKILL.md")));
        assert.ok(existsSync(join(path, "scripts/voloirex.mjs")));
        assert.ok(existsSync(join(path, "scripts/client.mjs")));
      }
    }
    const second = install(home, "");
    assert.equal(second.status, 0, second.stderr || second.stdout);
    assert.equal(JSON.parse(readFileSync(join(home, ".voloirex/config.json"), "utf8")).api_key, key);
    // Exercise the installed command, including a path containing spaces and exit status.
    const launcher = process.platform === "win32"
      ? join(home, ".voloirex/voloirex.cmd") : join(home, ".local/bin/voloirex");
    function run(args) {
      if (process.platform === "win32") return spawnSync("powershell.exe", ["-NoProfile", "-Command",
        `& '${launcher.replaceAll("'", "''")}' ${args}; exit $LASTEXITCODE`], { encoding: "utf8" });
      return spawnSync(launcher, [args], { encoding: "utf8" });
    }
    const help = run("--help");
    assert.equal(help.status, 0, help.stderr || help.stdout);
    assert.match(help.stdout, /voloirex run <agent>/);
    const unknown = run("unknown-command");
    assert.notEqual(unknown.status, 0);
    assert.match(unknown.stderr, /Unknown command/);
    const invalid = install(home, "invalid-key");
    assert.notEqual(invalid.status, 0);
    assert.equal(JSON.parse(readFileSync(join(home, ".voloirex/config.json"), "utf8")).api_key, key);
  } finally { rmSync(home, { recursive: true, force: true }); }
});
