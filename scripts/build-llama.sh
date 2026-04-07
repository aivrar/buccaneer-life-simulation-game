#!/bin/bash
# Build llama.cpp with CUDA support on Windows
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
LLAMA_DIR="$ROOT_DIR/llama.cpp"

echo "=== Building llama.cpp with CUDA ==="
echo "Source: $LLAMA_DIR"

# Apply any patches
if [ -d "$ROOT_DIR/patches" ] && ls "$ROOT_DIR/patches"/*.patch 1>/dev/null 2>&1; then
    echo "Applying patches..."
    cd "$LLAMA_DIR"
    for patch in "$ROOT_DIR/patches"/*.patch; do
        echo "  Applying: $(basename "$patch")"
        git apply --check "$patch" 2>/dev/null && git apply "$patch" || echo "  (already applied or conflicts)"
    done
fi

cd "$LLAMA_DIR"

cmake -B build \
    -G "Visual Studio 17 2022" \
    -DGGML_CUDA=ON \
    -DCMAKE_CUDA_ARCHITECTURES="86;89" \
    -DBUILD_SHARED_LIBS=OFF

cmake --build build --config Release -j

echo ""
echo "=== Build complete ==="
echo "llama-server: $LLAMA_DIR/build/bin/Release/llama-server.exe"
ls -la "$LLAMA_DIR/build/bin/Release/llama-server.exe" 2>/dev/null || echo "(check build/bin/ for output)"
