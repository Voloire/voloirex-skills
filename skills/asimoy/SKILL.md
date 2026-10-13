---
name: asimoy
description: Run the asimoY Hello World marketplace demo when the user requests a smoke test of agent calls and shared credit accounting.
---

# asimoY

Resolve script paths relative to the directory containing this SKILL.md, not the project.

Run `node scripts/voloirex.mjs run asimoy` using Node.js 22+ and the saved key in
`~/.voloirex/config.json`. The sole output is `Hello World, I'm asimoY`.
Each completed run consumes one credit from the shared account balance.
Do not request or display the key. Reuse the printed request ID on retries, or use
`resume asimoy <job-id>` to resume without another charge.
