#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-repo}"

run_backend() {
  cd "$ROOT_DIR/backend"
  ruff format --check .
  ruff check .
  pytest
}

run_frontend() {
  cd "$ROOT_DIR/frontend"
  npm run lint
  npm run test
  npm run build
}

case "$TARGET" in
  backend)
    run_backend
    ;;
  frontend)
    run_frontend
    ;;
  repo|all)
    run_backend
    run_frontend
    ;;
  *)
    echo "Usage: scripts/dev-check.sh [backend|frontend|repo]" >&2
    exit 1
    ;;
esac
