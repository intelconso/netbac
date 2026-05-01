#!/usr/bin/env bash
# Link Claude's per-project memory dir to .claude/memory in this repo
# so memory is synced across machines via git.
# Run once after `git clone` on a new machine.

set -euo pipefail

REPO_MEMORY="$(cd "$(dirname "$0")" && pwd)/.claude/memory"
HOME_MEMORY="$HOME/.claude/projects/-home-fares-projects-netbac/memory"

if [ ! -d "$REPO_MEMORY" ]; then
  echo "Error: $REPO_MEMORY not found. Are you in the netbac repo?" >&2
  exit 1
fi

mkdir -p "$(dirname "$HOME_MEMORY")"

if [ -L "$HOME_MEMORY" ]; then
  current="$(readlink "$HOME_MEMORY")"
  if [ "$current" = "$REPO_MEMORY" ]; then
    echo "Already linked: $HOME_MEMORY -> $REPO_MEMORY"
    exit 0
  fi
  echo "Replacing existing symlink ($current -> $REPO_MEMORY)"
  rm "$HOME_MEMORY"
elif [ -e "$HOME_MEMORY" ]; then
  backup="${HOME_MEMORY}.backup.$(date +%s)"
  echo "Existing memory dir found. Backing up to: $backup"
  mv "$HOME_MEMORY" "$backup"
fi

ln -s "$REPO_MEMORY" "$HOME_MEMORY"
echo "Linked: $HOME_MEMORY -> $REPO_MEMORY"
