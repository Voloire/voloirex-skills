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

The installer places `voloirex.mjs` in `~/.voloirex/` and the key in
`~/.voloirex/config.json`.

## Run

```bash
node ~/.voloirex/voloirex.mjs review "architecture text" --profile C
node ~/.voloirex/voloirex.mjs run asimoz
```

The client reads the key from `VOLOIREX_API_KEY`, then `~/.voloirex/config.json`. Endpoint
override: `VOLOIREX_ENDPOINT`.

## Layout

- `cli/voloirex.mjs` — generic MCP client (Node 22+, no dependencies).
- `install/install.ps1` — Windows installer.
- `install/install.sh` — macOS / Linux installer.

## TODO

- `winget` manifest and signed releases for Windows.
- Per-agent skills (SKILL.md) installed alongside the client so `run <agent>` and the Claude
  / Codex skill use the same key.