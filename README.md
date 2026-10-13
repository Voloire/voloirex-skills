# voloirex-skills

The one-shot installer and CLI for the voloirex agent marketplace. A user copies a single
command from the console and it installs the client and saves their API key. The same client
drives every agent on `mcp.voloirex.com`.

## Install

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/Voloire/voloirex-skills/main/install/install.ps1 -OutFile $env:TEMP\voloirex-install.ps1; & $env:TEMP\voloirex-install.ps1 -Key '<TOKEN>'
```

macOS / Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/Voloire/voloirex-skills/main/install/install.sh -o /tmp/voloirex-install.sh && VOLOIREX_API_KEY='<TOKEN>' bash /tmp/voloirex-install.sh
```

The installer places `voloirex.mjs` and `client.mjs` in `~/.voloirex/`, saves the key in
`~/.voloirex/config.json`, and installs all three skills under both `~/.claude/skills/`
and `~/.codex/skills/`. Node.js 22+ must be installed first (Windows:
`winget install OpenJS.NodeJS.LTS`). Reinstalling without a key preserves the existing key.

## Run

```bash
node ~/.voloirex/voloirex.mjs review "architecture text" --profile C
node ~/.voloirex/voloirex.mjs run asimoz
node ~/.voloirex/voloirex.mjs resume asimoz <job-id>
```

Windows PowerShell equivalent:

```powershell
node "$env:USERPROFILE\.voloirex\voloirex.mjs" run asimoz
```

Skill instructions resolve bundled scripts from the skill directory, not from the project cwd.

The client reads the key from `VOLOIREX_API_KEY`, then `~/.voloirex/config.json`. Endpoint
override: `VOLOIREX_ENDPOINT`.
Every run prints a request ID before submission. Use `--request-id <same-id>` with identical
inputs after a lost response, or resume the job ID without another start. Waiting and
individual network requests are bounded; use `--timeout-seconds` to adjust the overall limit.
Provider credentials are never needed on the client. asimoX currently returns PoC mock output.

## Verification

Run `npm test`. Tests use mocked HTTP and local installer fixtures, never marketplace or
provider endpoints. CI runs on Windows, Linux and macOS. Windows source installation:
`install/install.ps1 -InstallHome <temporary-home> -SourceDirectory <local-checkout> -Key <dummy-key>`.
POSIX source installation uses `VOLOIREX_HOME` and `VOLOIREX_SOURCE_DIR`.

## Layout

- `cli/voloirex.mjs` and `cli/client.mjs`: generic MCP client (Node 22+, no dependencies).
- `install/install.ps1` — Windows installer.
- `install/install.sh` — macOS / Linux installer.

## TODO

- `winget` manifest and signed releases for Windows.
- Published winget distribution is separate from using winget to install the Node prerequisite;
  no marketplace winget package has been published yet.
