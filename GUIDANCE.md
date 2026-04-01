# Standing Policies

This document is referenced by every phase prompt. Its policies override any
conflicting assumption the agent might make.

---

## 1. Tests

### 1.1 What constitutes the test suite

The primary gate is:
```
BABEL_RUST_GENERATOR=1 yarn jest packages/babel-generator
```

After each phase completes, also run the broader integration tests:
```
BABEL_RUST_GENERATOR=1 yarn jest packages/babel-core
BABEL_RUST_GENERATOR=1 yarn jest packages/babel-cli
```
Failures there should be investigated but do not block progress on the
generator-specific suite.

### 1.2 What "passing" means

Byte-identical generated code strings compared to the TS implementation.
No "close enough".

### 1.3 Snapshot tests

NEVER run `--updateSnapshot` / `-u` to make a failing snapshot pass. A
mismatch means the Rust output differs from the TS output, which is a bug.

### 1.4 Flaky tests

Run a suspect test 10 times in isolation. If it fails >= 2/10 with TS too,
it is pre-existing and can be noted in the progress log and excluded from
the gate. If it fails only with Rust, it is a Rust bug - fix it.

### 1.5 Test modification prohibition

The agent must NOT:
- Delete any test file, test case, or assertion
- Change any expected output or fixture
- Add `skip`, `xtest`, `xit`, or conditional skipping
- Add `try/catch` around assertions
- Change test runner configuration to exclude tests
- Modify any file under packages/babel-generator/test/ except to ADD new
  tests (which must also pass under the TS implementation)

---

## 2. AST Access Architecture

### 2.1 The abstraction layer

All printing logic must be written against a compile-time-abstract AST access
trait, not against any specific marshaling mechanism. Swapping the underlying
strategy must require ZERO changes to the printing code.

Requirements:
- Methods like `node.node_type()`, `node.get_field("name")`,
  `node.children("body")`, etc.
- Associated type for child nodes so traversal returns the same abstract type
- Implementable for JsObject wrappers, owned Rust structs, lazy converters,
  and any future strategy
- The trait boundary is the ONLY place printing code touches AST data
- Use Rust generics (not trait objects) for zero-cost monomorphization
- Select the active strategy via Cargo feature flags (e.g., `--features
  ast-napi`, `--features ast-serde`)

### 2.2 Marshaling strategies to explore (Phase 7)

These must be implemented and benchmarked empirically. Do NOT pre-select a
winner.

**A. Full napi JsObject access (baseline).** Every property access goes
through napi to V8. Thin Rust wrappers provide the trait interface.

**B. JSON.stringify + serde_json.** Serialize on the JS side, deserialize in
Rust. One large upfront cost, then native access.

**C. Lazy per-node conversion.** JsObject root; each node is deserialized to
a Rust struct on first access, cached.

**D. TS-side builder.** TypeScript walks the AST and calls napi-exported Rust
functions to construct the Rust AST node by node.

**E. Custom binary format.** MessagePack or hand-rolled schema-driven format,
passed as a Buffer.

**F. Rust kernel replacements (no full port).** Keep the TS generator; replace
only self-contained low-level components (output buffer, source map encoding,
etc.) with Rust via napi. This sidesteps AST marshaling entirely. See Phase 6.

Additional strategies may be proposed if profiling reveals opportunities.

### 2.3 Rust AST type definitions

For strategies needing Rust types (B, C, D, E):
- Auto-generate from `@babel/types`'s definitions if machine-readable
  (check `packages/babel-types/src/definitions/`). Use a build script.
- Otherwise, manually define the ~50 most common node types; use a catch-all
  `Unknown(serde_json::Value)` for the rest.
- Use `#[serde(tag = "type")]` for tagged union deserialization.

### 2.4 Output buffer

- Single `Vec<u8>` for the entire `generate()` call
- Pre-allocated with a heuristic capacity
- Write via `write!()` / `push_str()`
- Convert to `String` once at the end

### 2.5 Source maps

- Phase 4: delegate to JS via napi (correct but slow)
- Phase 8: port to Rust using the `sourcemap` crate

### 2.6 Comment handling

Translate exactly as-is. Do not simplify or refactor unless profiling shows
it is a top-3 bottleneck.

---

## 3. JS-to-Rust Translation Policies

### 3.1 Dynamic property access

Use a helper: `fn get_prop(obj: &JsObject, key: &str) -> napi::Result
<JsUnknown>` in a local `js_interop.rs` module. All dynamic access goes
through this helper so it can be replaced later.

### 3.2 `this` and class methods

Translate the `Printer` class as a Rust struct with `&self` / `&mut self`
methods. Hold a `JsObject` reference to the JS-side Printer and a
`napi::Env` reference. Single concrete struct, no trait objects.

### 3.3 Callbacks and higher-order functions

Phase 4: implement as Rust methods that call back into JS via
`JsFunction::call()`. Phase 8: replace with Rust `match` on node type enum.

### 3.4 null vs undefined

Treat both as `None` in Rust. If output depends on distinguishing them (rare),
use a custom `JsNullable { Null, Undefined, Value(T) }` with a comment.

### 3.5 String encoding

Use `JsString::into_utf8()` for JS-to-Rust conversion. Output buffer is
UTF-8 (correct for JS source code).

### 3.6 Error handling

- `napi::Result<T>` for all JS-interop functions
- Propagate with `?`, never `unwrap()` on JS interop results
- Internal logic errors use `unreachable!()` or `debug_assert!()`

---

## 4. Dependencies

### 4.1 Allowed Rust crates

| Crate | Purpose |
|---|---|
| napi, napi-derive | Node addon bridge (stable 2.x) |
| serde, serde_json, serde_derive | AST deserialization |
| smallvec | Stack-allocated small vectors |
| compact_str or smol_str | Small string optimization |
| sourcemap | Source map reading/writing |
| rmp-serde | MessagePack (only if JSON bottlenecks) |
| criterion | Rust-side microbenchmarks |
| memchr | Fast byte scanning |
| itoa, ryu | Fast number-to-string |

### 4.2 Not allowed without explicit justification

- Async runtimes (tokio, async-std)
- Custom allocators (jemalloc, mimalloc)
- Crates with < 100k downloads
- `unsafe`-heavy crates without established safety records

---

## 5. Benchmarks

### 5.1 Statistical rigour

- Minimum 3 runs per measurement
- Report medians (not means)
- Significant = median difference > interquartile range of "before" runs
- If variance > 20%, increase iterations until it drops below 10%

### 5.2 What "10x" means

Rust median wall-clock time <= 1/10th of TS median, on EACH benchmark
workload independently. If a trivially-small workload resists 10x due to
startup overhead, note it and consider the loop complete if all
non-trivially-small workloads hit the target.

### 5.3 Workload integrity

Benchmark workloads must not be modified or removed during optimization.
New workloads may be added.

---

## 6. Git and Commits

- Branch: `rust/generator-port` (linear history, no sub-branches)
- Remote: https://github.com/motiz88/babel
- Conventional commit format: `type(scope): description`
  - Types: feat, fix, perf, refactor, docs, test, build, ci, chore
  - Scopes: generator, generator/rust, infra
- Push to the remote branch after completing meaningful units of work.
  The orchestrator also pushes after each phase.
- Progress log: the orchestrator maintains a progress log at
  `fbsource/users/mo/moti/babel-rust-port/PROGRESS_LOG.md` with
  timestamps, branch names, and commit refs. Do not modify it directly;
  the orchestrator writes to it.

---

## 7. Platform and Toolchain

- Rust: stable, pinned via rust-toolchain.toml
- Node.js: match Babel's `engines` field
- napi-rs Node-API version: match oldest supported Node's NAPI level
- Prebuild targets: x86_64-unknown-linux-gnu, x86_64-unknown-linux-musl,
  aarch64-unknown-linux-gnu, aarch64-unknown-linux-musl,
  x86_64-apple-darwin, aarch64-apple-darwin, x86_64-pc-windows-msvc,
  aarch64-pc-windows-msvc

---

## 8. When to Stop and Leave a Note

Write a detailed note in the progress log and stop if:
- `cargo build` fails after 5 distinct fix attempts
- A test failure cannot be diagnosed after reading all relevant code
- Rust is slower than TS after 20+ optimization iterations
- A file exceeds 2000 lines and resists translation
- Runtime-mutable global state requires `unsafe`

The note must include: what was attempted, why it failed, what the agent
believes the resolution is, and what information it needs to proceed.

---

## 9. Out of Scope

- Porting any other Babel package to Rust
- Modifying @babel/parser, @babel/types, @babel/traverse source
- Adding new public APIs beyond the Rust toggle
- Changing generator output format or behaviour
- Modifying the TS generator source (it must remain buildable)
- Upgrading Babel's dependencies (unless strictly required for Rust
  integration)
