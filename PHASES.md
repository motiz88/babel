# Phase Plan

This document consolidates all phase instructions for the Babel generator
Rust port. Read GUIDANCE.md first — its policies override everything here.

Work through phases sequentially. Each phase has exit criteria that must be
met before moving on. Track progress in
`packages/babel-generator/RUST_PORT_PROGRESS_LOG.md`.

---

## Phase 1: Reconnaissance

The orchestrator has already cloned https://github.com/motiz88/babel and
checked out branch `rust/generator-port`. You are running in that clone.
Confirm you are on the correct branch before proceeding.

### Part A: Map the codebase

1. Read the top-level package.json, Makefile, and CI configs
   (.github/workflows/*). Summarize the build system, test runner, and how
   packages are built and tested individually vs as a monorepo.

2. List every file in packages/babel-generator/src/ with line counts. Read
   each fully. Produce a dependency graph: which files import from which,
   and which import from other @babel packages or external deps.

3. Identify every test suite that exercises @babel/generator (its own tests
   and integration tests elsewhere that depend on generator output). Run the
   generator tests. Record the command, runtime, and pass/fail counts.

4. Document @babel/generator's public API: every exported function, type,
   and option.

5. Check for any existing native/compiled dependencies in the Babel repo.

### Part B: Pipeline impact assessment

Establish whether optimizing @babel/generator has meaningful end-to-end
impact.

1. Assemble at least 10 diverse (source file, Babel config) pairs:
   - Large JS bundle with @babel/preset-env
   - Large TS file with @babel/preset-typescript
   - JSX-heavy file with @babel/preset-react
   - Decorators-heavy file
   - Small file with minimal transforms (fixed-overhead baseline)
   - Medium file with many plugins
   - Files from real open-source projects if available in the repo

2. Measure per-phase wall-clock time (parse, transform, generate) for each
   workload. Use one or more of:
   - An instrumented wrapper that calls parser, transform, and generator
     separately
   - Temporary timing patches inside @babel/core's transform function
   - `node --cpu-prof` with call tree attribution
   Cross-validate with at least two methods.

3. For each workload, compute:
   - `gen_fraction = gen_median / total_median`
   - `theoretical_max_speedup = 1 / (1 - gen_fraction)` (Amdahl's law)
   - `speedup_at_10x = 1 / (1 - gen_fraction * 0.9)`

4. Write an explicit assessment: which workload classes are generator-heavy
   (> 30% of pipeline time)? What is the median generator fraction? This
   informs which benchmark workloads to prioritize later.

### Output

Write all findings to packages/babel-generator/RUST_PORT_PLAN.md:
- Build & Test Infrastructure Summary
- File Inventory with dependency graph
- Public API Surface
- Test Suite Inventory
- Pipeline Impact Assessment (table + analysis)
- Open Questions / Risks

Commit: `docs: reconnaissance and pipeline impact assessment`

### Exit criteria

The commit exists. Test suite baseline is recorded. Pipeline impact is
measured for >= 10 workloads with a clear assessment.

---

## Phase 2: Rust Infrastructure

Create generic Rust infrastructure for the Babel monorepo. Nothing in this
phase is specific to @babel/generator. All commits should be reusable by
future Rust ports of other packages.

### Part A: Workspace and utilities

1. Create `crates/Cargo.toml` as a Cargo workspace.

2. Add `crates/babel-napi-utils/` with:
   - Error conversion helpers (napi::Error <-> Babel conventions)
   - JsValue introspection helpers for extracting fields from JS objects
   - The `get_prop` helper from GUIDANCE.md section 3.1
   - A feature-toggle skeleton: check env var or options flag to choose
     between Rust and JS implementations

3. Add `rust-toolchain.toml` at the repo root pinning to stable.

### Part B: Build integration

1. Add `scripts/build-rust.sh` (or similar) that runs `cargo build` in the
   workspace. Accept `--release`. Integrate with the Makefile / top-level
   package.json so `make build` also builds Rust crates (warn and skip if
   Rust is not installed).

2. Add `.github/workflows/rust.yml`: install Rust, run `cargo check`,
   `cargo test`, `cargo clippy`. Same triggers as existing JS CI.

### Part C: Prebuild template

1. Add `crates/babel-napi-template/` demonstrating the napi-rs prebuild
   pattern: a trivial exported function, platform target packages for all
   targets in GUIDANCE.md section 7, a GitHub Actions workflow for
   cross-platform builds.

2. Add a script that generates platform package stubs given a crate name
   (reusable for @babel/generator and future crates).

3. Verify: template builds locally, JS test passes with BABEL_USE_RUST=1,
   JS fallback works with BABEL_USE_RUST=0.

### Part D: Documentation

Add top-level RUST.md: prerequisites, how to build, how the toggle works,
how to run Rust tests, architecture overview.

### Commits

1. `infra: add Cargo workspace and babel-napi-utils`
2. `infra: add Rust build scripts and Makefile integration`
3. `infra: add Rust CI workflow`
4. `infra: add napi-rs prebuild template and platform stub generator`
5. `docs: add RUST.md`

### Exit criteria

`cargo check` succeeds. Build script runs without error. Template crate
builds and passes its JS test with both toggle states. CI workflow is valid.

---

## Phase 3: Direct Port

Pay particular attention to GUIDANCE.md sections 2.1 (AST abstraction
layer) and 3 (translation policies).

Translate @babel/generator from TypeScript to Rust, file by file.

### Part A: Scaffold

1. Create `crates/babel-generator/` with Cargo.toml depending on napi-rs and
   babel-napi-utils. In src/lib.rs, export a `generate` function that accepts
   a JsObject AST and JsObject options, and for now just calls back into the
   JS implementation (pass-through stub).

2. In packages/babel-generator/, add a `native.js` module that loads the Rust
   addon, and modify the entry point to check the feature toggle:
   - `BABEL_RUST_GENERATOR=1` env var, OR
   - `{ useNative: true }` in options
   - Either enables the Rust path. Default is TS.

3. Run the full test suite with toggle OFF (must be 100% pass), then with
   toggle ON (pass-through stub should also pass). Fix plumbing until both
   pass.

### Part B: AST access trait

Before translating any printing code, create the abstraction layer from
GUIDANCE.md section 2.1:

1. Define the trait(s) in `src/ast_access.rs` (or `src/ast_access/mod.rs`).
2. Implement the `ast-napi` strategy: thin wrappers around JsObject.
3. Gate behind `--features ast-napi` (default on).
4. No printing function may import napi types directly. All AST access goes
   through the trait.

### Part C: Translation

1. Read every file in packages/babel-generator/src/. Produce a translation
   order: leaf files first, then inward to dependents, finishing with the
   entry point.

2. Create packages/babel-generator/RUST_PORT_PROGRESS_LOG.md with the
   translation order as a checklist.

3. Translate each file. Rules:
   - DIRECT TRANSLATION: same structure, control flow, variable names
     (adapted to Rust conventions), same comments.
   - All AST access through the trait from Part B.
   - External @babel package calls (e.g., @babel/types) go through napi
     JS function calls, wrapped in helpers.
   - Replicate JS-isms faithfully (dynamic property access, string-based
     dispatch, etc.) even if ugly. Correctness over elegance.
   - Follow GUIDANCE.md section 3.6: `napi::Result<T>`, propagate with `?`,
     never `unwrap()` on JS interop.
   - Use `todo!()` for calls to not-yet-translated modules.

4. Wire up `generate` in lib.rs to use the Rust implementation instead of
   the pass-through.

5. Run the test suite with `BABEL_RUST_GENERATOR=1`. Record pass/fail counts
   in the progress log. Many failures are expected at this stage.

### Commits

1. `feat(generator): add Rust crate scaffold with pass-through stub`
2. `feat(generator): add feature toggle for Rust vs TS implementation`
3. `feat(generator): initial direct Rust translation of all source files`
4. `docs(generator): add Rust port progress log with initial test results`

### Exit criteria

`cargo build` succeeds. Progress log has initial test results. Toggle works
in both states. The TS implementation is completely unaffected.

---

## Phase 4: Fix All Failing Tests (iterative loop)

GUIDANCE.md Section 1 (Tests) is non-negotiable throughout this phase.

Iteratively fix the Rust port until all tests pass with
`BABEL_RUST_GENERATOR=1`.

Before your first iteration, read:
- packages/babel-generator/RUST_PORT_PROGRESS_LOG.md
- The last few git commits on this branch

### Rules

See GUIDANCE.md section 1.5 for the complete prohibition list. In short:
NEVER modify, delete, skip, or disable any test.

### Each iteration

1. Run the test suite with bail-on-first-failure:
   ```
   BABEL_RUST_GENERATOR=1 yarn jest packages/babel-generator --bail 2>&1 | head -200
   ```

2. If all tests pass, write a final entry in the progress log, commit, and
   exit this phase.

3. Otherwise, pick ONE failing test. Read the test, expected output, actual
   output, and the Rust code that produces the wrong output.

4. Diagnose the root cause. Common categories: missing node type handler,
   whitespace/newline differences, semicolon insertion, comment handling,
   parenthesization, source maps, option handling, string encoding.

5. Fix the Rust code. Run the FULL test suite (not just the one test):
   ```
   BABEL_RUST_GENERATOR=1 yarn jest packages/babel-generator 2>&1 | tail -20
   ```

6. If same or fewer failures: commit the fix and an appended entry in the
   progress log (date, which test, root cause category, what changed,
   current pass/fail counts).
   Commit: `fix(generator/rust): [short description]`

7. If new regressions: revert and try differently. After 3 failed attempts,
   note it in the log as "deferred" and move to a different failing test.

8. If you hit a situation from GUIDANCE.md section 8, write the note and
   stop.

### Exit criteria

Full test suite passes with `BABEL_RUST_GENERATOR=1`.

---

## Phase 5: Benchmark and Profile

Before starting, read:
- packages/babel-generator/RUST_PORT_PLAN.md (especially the pipeline impact
  assessment from Phase 1, which identifies generator-heavy workload classes)

### Part A: Benchmark harness

#### Workloads

Create packages/babel-generator/bench/ with representative inputs.
Prioritize workload types that Phase 1 identified as generator-heavy:

- Large real-world JS file (find in repo fixtures or use lodash/react source)
- JSX-heavy file
- TypeScript-heavy file
- Template literals and tagged templates
- Deeply nested expressions and arrow functions
- Many comments, block and line, and decorators

Use real files where possible. Write synthetic ones (200+ lines) for gaps.

#### bench.mjs

Create packages/babel-generator/bench/bench.mjs that:
- Parses each input to an AST via @babel/parser
- Runs generate() with TS implementation, measuring wall-clock time across N
  iterations (auto-calibrate: double N from 10 until total > 2 seconds)
- Runs generate() with Rust implementation (same N)
- Reports per-workload: median, p95, p99, min, max for each implementation
- Reports ratio: TS_median / Rust_median
- Reports memory: process.memoryUsage() before/after each batch
- Outputs human-readable table to stdout and JSON to
  bench/results/<ISO-timestamp>.json
- Flags: `--json` (suppress table), `--runs N` (repeat benchmark N times for
  variance check)

Add `yarn bench:generator` to package.json scripts.

#### Baseline

Run the benchmark. Record baseline results (the direct-port Rust
implementation may be comparable to or slower than TS at this stage).

### Part B: Deep performance study

#### V8 profiling

Profile the TS generator on each benchmark workload using:

1. **Tick profiling** (`node --prof` / `node --prof-process`): top 20
   functions by self-time and total-time.

2. **CPU profiling** (`node --cpu-prof`): call tree structure, hot paths.

3. **Manual instrumentation** (temporary, do not commit): wrap
   `performance.now()` around major functional boundaries.

#### Test suite profiling

Run the full test suite under `node --cpu-prof --runInBand`. Identify
hot code paths and disproportionately slow tests.

#### Memory and GC

Run with `node --trace-gc` and analyze GC pauses, heap growth, allocation
per generate() vs final output size.

#### JavaScript-specific limiters

Identify where JS runtime limits performance: string immutability,
megamorphic call sites, function call overhead, GC pressure, lack of
typed buffers.

#### Hypotheses

Produce a numbered list of testable performance hypotheses, ranked by
estimated impact.

#### Kernel candidates

Produce a ranked list of self-contained components suitable for Rust kernel
replacement (Phase 6).

### Output

Append to RUST_PORT_PROGRESS_LOG.md: time breakdown, memory/GC analysis,
JS-specific limiters, hypotheses, kernel candidate list.

### Commits

1. `bench(generator): add benchmark harness`
2. `bench(generator): record baseline results`
3. `docs(generator): deep performance study of TS implementation`

### Exit criteria

Benchmark harness works. Baseline recorded. Profiling data from >= 3 methods.
>= 5 testable hypotheses ranked. >= 3 kernel candidates ranked.

---

## Phase 6: Rust Kernel Replacements

Before starting, read the "Deep Performance Study" section of
RUST_PORT_PROGRESS_LOG.md from Phase 5.

Replace self-contained, low-level hotspots in the TS generator with Rust
implementations exposed via napi. This sidesteps AST marshaling entirely.

### Kernel selection

Use the Phase 5 ranked kernel candidate list. Start with the top candidate.

### For each kernel

**Rust side:** Create a crate (e.g., `crates/babel-generator-buffer/`).
Implement as a Rust struct with napi exports matching the TS class's full
public interface.

**JS side:** Add a loader module and feature toggles:
- `BABEL_RUST_KERNELS=1` enables all kernels
- `BABEL_RUST_BUFFER=1` enables only the buffer kernel
- These are INDEPENDENT of the full-port toggle.

**Verify:** `BABEL_RUST_BUFFER=1 yarn jest packages/babel-generator` — all pass.

**Benchmark:** 3 runs in each configuration.

### Commits

1. `perf(generator): add Rust buffer kernel with napi interface`
2. `feat(generator): add kernel feature toggles`
3. One commit per additional kernel
4. `bench(generator): kernel replacement benchmark results`

### Exit criteria

At least one kernel implemented, all tests pass with it enabled, benchmark
results recorded.

---

## Phase 7: AST Marshaling Strategy Exploration

See GUIDANCE.md section 2.2 for strategy definitions and 2.3 for Rust AST types.

Before starting, read:
- RUST_PORT_PROGRESS_LOG.md: Phase 5 performance study and Phase 6 results
- crates/babel-generator/src/ast_access.rs: the trait abstraction from Phase 3

### Prerequisites

1. AST access trait exists and all printing logic is generic over it.
2. All tests pass with `BABEL_RUST_GENERATOR=1` and the `ast-napi` strategy.

### For each strategy (A through E from GUIDANCE.md section 2.2)

Implement, verify (all tests pass), and benchmark (3 runs).

Strategy F (kernel-only) is already from Phase 6 — pull its results into
the comparison.

If a strategy can't be made to work after ~2-3 hours, note the failure
mode and move on.

### Comparative analysis

Write to RUST_PORT_PROGRESS_LOG.md:
1. All strategies side by side across all workloads
2. Winner and why
3. Kernel-only vs best full-port comparison
4. Set winning strategy as default Cargo feature

### Exit criteria

>= 3 full-port strategies benchmarked (plus kernel results from Phase 6).
Comparative analysis committed. Winning strategy set as default.

---

## Phase 8: Optimize (iterative loop)

Before your first iteration, read:
- RUST_PORT_PROGRESS_LOG.md: Phase 7 comparative analysis
- Current benchmark results: `yarn bench:generator`

### Each iteration

1. Benchmark: `yarn bench:generator 2>&1 | tee /tmp/bench-before.txt`
2. Profile to find the biggest remaining bottleneck.
3. Choose ONE optimization unit. Keep the diff focused.
4. Test: `BABEL_RUST_GENERATOR=1 yarn jest packages/babel-generator 2>&1 | tail -5`
5. Benchmark 3 times. Significant improvement? (GUIDANCE.md section 5.1)
6. If tests pass AND significant gain: commit + log entry.
   If no gain: revert + log "attempted, no gain".
7. Check ratios. If all workloads >= 10x: done.

### Full-port optimization priorities

1. Confirm winning strategy is active
2. Write buffer: single Vec<u8>, pre-allocated
3. Enum dispatch
4. Formatting constants
5. Allocation reduction: SmallVec, Cow<str>, itoa/ryu
6. Source maps: port to Rust
7. Revisit marshaling if it dominates
8. Parallelism (speculative, only if single-threaded gains plateau)

### Kernel optimization priorities

1. Re-profile after kernel replacements
2. Refine existing kernels
3. New kernel candidates
4. Batch API
5. Move dispatch to Rust

### Exit criteria

- 10x target achieved across all workloads (full-port path), OR
- Optimization plateaued (kernel path, note where remaining time is spent)

---

## Phase 9: Release Packaging

### Platform packages

Configure packages/babel-generator/package.json with optionalDependencies
for each platform binary, postinstall verification, correct `files` field.

### CI prebuild

Add `.github/workflows/generator-prebuild.yml` for all targets in
GUIDANCE.md section 7, triggered on release tags.

### Toggle verification

Run full test suite in each scenario:
- Rust available, toggle ON -> uses Rust, all pass
- Rust available, toggle OFF (default) -> uses TS, all pass
- Rust NOT available (rename .node file) -> TS with warning, all pass

### Documentation

- Update packages/babel-generator/README.md
- Update RUST.md
- Update RUST_PORT_PROGRESS_LOG.md with final summary

### Commits

1. `build(generator): add napi-rs platform packages and prebuild config`
2. `ci(generator): add cross-platform prebuild workflow`
3. `feat(generator): robust native addon loading with graceful fallback`
4. `docs(generator): document Rust implementation`

### Exit criteria

All commits exist. All three toggle scenarios pass. Documentation complete.
Branch ready for human review.
