---
name: asimox
description: Run an asimoX architecture review using the voloirex marketplace key when the user requests an agent design review against the twelve Pact controls.
---

# asimoX

Use Node.js 22+ and the saved marketplace key in `~/.voloirex/config.json`.
The server currently runs in PoC mock mode: outputs are demonstrations, not real evaluations.
Never request or display the key in chat.

Run the bundled client:

Resolve `scripts/voloirex.mjs` relative to the directory containing this SKILL.md,
not relative to the user's project working directory.

```bash
node scripts/voloirex.mjs review --file design.md --profile C
```

Profiles: L (read/analyze), C (shared-code development), D (supervised action), A (bounded automation).
Add evidence with `--evidence name=path`. Reuse the printed `--request-id` when retrying
the same inputs. Use `resume asimox <job-id>` to retrieve an existing job without starting another.
The account has one shared credit balance and this key's monthly cap applies across its agents.
