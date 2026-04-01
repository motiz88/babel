#!/bin/bash
# Build Rust crates in the Babel workspace.
# Usage: scripts/build-rust.sh [--release]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CRATES_DIR="$REPO_ROOT/crates"

if ! command -v cargo &> /dev/null; then
  echo "Warning: Rust toolchain not found. Skipping Rust build."
  echo "Install Rust from https://rustup.rs/ to build native addons."
  exit 0
fi

PROFILE="debug"
BUILD_ARGS=""
if [ "$1" = "--release" ]; then
  BUILD_ARGS="--release"
  PROFILE="release"
  echo "Building Rust crates (release)..."
else
  echo "Building Rust crates (debug)..."
fi

cd "$CRATES_DIR"
cargo build $BUILD_ARGS

# Copy the cdylib to a .node file that Node.js can require()
TARGET_DIR="$CRATES_DIR/target/$PROFILE"
case "$(uname -s)" in
  Darwin) DYLIB="libbabel_generator.dylib" ;;
  MINGW*|MSYS*|CYGWIN*) DYLIB="babel_generator.dll" ;;
  *) DYLIB="libbabel_generator.so" ;;
esac

if [ -f "$TARGET_DIR/$DYLIB" ]; then
  cp "$TARGET_DIR/$DYLIB" "$TARGET_DIR/babel_generator.node"
  echo "Created $TARGET_DIR/babel_generator.node"
else
  echo "Error: Expected library not found at $TARGET_DIR/$DYLIB" >&2
  exit 1
fi

echo "Rust build complete."
