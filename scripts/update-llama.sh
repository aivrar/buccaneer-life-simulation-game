#!/bin/bash
# Pull latest llama.cpp upstream and rebuild
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Updating llama.cpp submodule ==="
cd "$ROOT_DIR"
git submodule update --remote --merge

echo "=== Rebuilding ==="
bash "$SCRIPT_DIR/build-llama.sh"

echo "=== Update complete ==="
