#!/usr/bin/env bash
set -euo pipefail

KEY="${VOLOIREX_API_KEY:-${ASIMOX_API_KEY:-}}"
REPO="Voloire/voloirex-skills"
REF="main"
home="${VOLOIREX_HOME:-$HOME}"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

curl -fsSL "https://codeload.github.com/${REPO}/archive/refs/heads/${REF}.tar.gz" -o "$tmp/repo.tar.gz"
tar -xzf "$tmp/repo.tar.gz" -C "$tmp"
dir="$(find "$tmp" -mindepth 1 -maxdepth 1 -type d | head -n1)"

mkdir -p "$home/.voloirex"
install -m 755 "$dir/cli/voloirex.mjs" "$home/.voloirex/voloirex.mjs"

if [ -n "$KEY" ]; then
  printf '{"api_key":"%s"}\n' "$KEY" > "$home/.voloirex/config.json"
  chmod 600 "$home/.voloirex/config.json"
  echo "voloirex CLI installed. Key saved to $home/.voloirex/config.json"
else
  echo "voloirex CLI installed. No key saved - re-run with VOLOIREX_API_KEY=<token>."
fi