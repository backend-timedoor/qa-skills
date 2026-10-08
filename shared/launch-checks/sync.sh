#!/usr/bin/env bash
# Copy shared/launch-checks into each launch-check plugin's vendor/ folder.
# Usage: sync.sh          copy
#        sync.sh --check  exit 1 if any copy differs from shared/
set -euo pipefail

ROOT="${LC_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
SRC="$ROOT/shared/launch-checks"
PLUGINS=(pre-launch-check post-launch-check)
EXCLUDES=(-x node_modules -x test -x skill-templates -x __pycache__)

status=0
for p in "${PLUGINS[@]}"; do
  dest="$ROOT/plugins/$p/vendor/launch-checks"
  if [[ "${1:-}" == "--check" ]]; then
    if [[ ! -d "$dest" ]] || ! diff -rq "${EXCLUDES[@]}" "$SRC" "$dest" >/dev/null; then
      echo "DRIFT: plugins/$p/vendor/launch-checks differs from shared/launch-checks (run shared/launch-checks/sync.sh)" >&2
      status=1
    fi
  else
    rm -rf "$dest"
    mkdir -p "$dest"
    (cd "$SRC" && tar --exclude=node_modules --exclude=test --exclude=skill-templates --exclude=__pycache__ -cf - .) | (cd "$dest" && tar -xf -)
    echo "synced plugins/$p/vendor/launch-checks"
  fi
done
exit $status
