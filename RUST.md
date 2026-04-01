# Rust in the Babel Monorepo

## Prerequisites

- [Rust stable](https://rustup.rs/) (pinned via `rust-toolchain.toml`)
- Node.js ^20.19.0 || >=22.12.0 (as per Babel's `engines` field)

## Building

```bash
# Build Rust crates (debug)
scripts/build-rust.sh

# Build Rust crates (release)
scripts/build-rust.sh --release

# Or as part of the full build
make build
```

## Feature Toggle

The Rust implementation is **off by default**. Enable it with:

```bash
# Environment variable
BABEL_RUST_GENERATOR=1 node your-script.js

# Or programmatically via options
import generate from "@babel/generator";
generate(ast, { useNative: true }, code);
```

When enabled, `@babel/generator` loads the Rust native addon. If the addon
is not available (not built, wrong platform), it **throws an error** rather
than silently falling back.

## Running Tests

```bash
# JS implementation (default)
yarn jest packages/babel-generator

# Rust implementation
BABEL_RUST_GENERATOR=1 yarn jest packages/babel-generator
```

## Workspace Layout

```
crates/
├── Cargo.toml              # Workspace root
├── babel-napi-utils/        # Shared napi-rs helpers
│   └── src/lib.rs
└── babel-generator/         # @babel/generator Rust port
    ├── build.rs
    └── src/lib.rs
```

## Architecture

The Rust crate is built as a cdylib (shared library) using
[napi-rs](https://napi.rs/) v2. It exports functions callable from Node.js
via the Node-API (N-API) stable ABI.

The entry point (`packages/babel-generator/src/index.ts`) checks the
feature toggle and loads the native addon if enabled. Currently the Rust
side is a pass-through stub that calls back into the JS implementation.
