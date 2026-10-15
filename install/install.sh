#!/usr/bin/env bash
set -euo pipefail

KEY="${VOLOIREX_API_KEY:-${ASIMOX_API_KEY:-}}"
REPO="Voloire/voloirex-skills"
REF="${VOLOIREX_REF:-main}"
home="${VOLOIREX_HOME:-$HOME}"
node -e 'if (Number(process.versions.node.split(".")[0]) < 22) process.exit(1)' || {
  echo "Node.js 22+ is required. Install Node.js LTS before running this installer." >&2
  exit 1
}
if [ -n "$KEY" ] && ! [[ "$KEY" =~ ^vx_[a-z2-7]{16}_[a-z2-7]{52}$ ]]; then
  echo "Invalid marketplace key format." >&2
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

if [ -n "${VOLOIREX_SOURCE_DIR:-}" ]; then
  dir="$VOLOIREX_SOURCE_DIR"
else
  curl -fsSL "https://codeload.github.com/${REPO}/tar.gz/refs/heads/${REF}" -o "$tmp/repo.tar.gz"
  tar -xzf "$tmp/repo.tar.gz" -C "$tmp"
  dir="$tmp/voloirex-skills-$REF"
fi
test -f "$dir/cli/voloirex.mjs"

mkdir -p "$home/.voloirex"
install -m 755 "$dir/cli/voloirex.mjs" "$home/.voloirex/voloirex.mjs"
install -m 644 "$dir/cli/client.mjs" "$home/.voloirex/client.mjs"
mkdir -p "$home/.local/bin"
ln -sf "$home/.voloirex/voloirex.mjs" "$home/.local/bin/voloirex"
case ":$PATH:" in
  *":$home/.local/bin:"*) echo "Command ready: voloirex run asimoz" ;;
  *) echo "Launcher installed. Add it to PATH: export PATH=\"$home/.local/bin:\$PATH\"" ;;
esac
for skill in "$dir"/skills/*; do
  test -f "$skill/SKILL.md"
  for client in .claude .codex; do
    dest="$home/$client/skills/$(basename "$skill")"
    mkdir -p "$dest/scripts"
    install -m 644 "$skill/SKILL.md" "$dest/SKILL.md"
    install -m 755 "$dir/cli/voloirex.mjs" "$dest/scripts/voloirex.mjs"
    install -m 644 "$dir/cli/client.mjs" "$dest/scripts/client.mjs"
  done
done

if [ -n "$KEY" ]; then
  printf '{"api_key":"%s"}\n' "$KEY" > "$home/.voloirex/config.json"
  chmod 600 "$home/.voloirex/config.json"
  echo "voloirex CLI installed. Key saved to $home/.voloirex/config.json"
else
  echo "voloirex CLI installed. No key written; existing config remains available."
fi
