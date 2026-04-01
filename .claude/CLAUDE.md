# Babel Generator Rust Port

You are working in a clone of https://github.com/motiz88/babel on branch
`rust/generator-port`. The goal is to port `@babel/generator` from TypeScript
to Rust, benchmark multiple optimization strategies, and target 10x throughput.

## How to work

1. Read `GUIDANCE.md` (repo root) for standing policies that override all else.
2. Read `PHASES.md` (repo root) for the full phase-by-phase plan.
3. Check `packages/babel-generator/RUST_PORT_PROGRESS_LOG.md` for current state.
4. Check `git log --oneline -20` to see what's been done.
5. Resume from where the last session left off.

## Key policies (from GUIDANCE.md)

- **Tests**: NEVER modify, delete, skip, or disable any test. Gate command: `BABEL_RUST_GENERATOR=1 yarn jest packages/babel-generator`
- **Correctness**: Byte-identical output vs TS implementation. No "close enough".
- **Snapshots**: NEVER use `--updateSnapshot` / `-u`.
- **AST access**: All printing logic behind a compile-time-abstract trait, not any specific marshaling mechanism.
- **Error handling**: `napi::Result<T>`, propagate with `?`, never `unwrap()` on JS interop.
- **Commits**: Conventional format `type(scope): description`. Push to `rust/generator-port`.
- **Stop conditions**: See GUIDANCE.md section 8. Leave a detailed note in progress log.

## Phase summary

| # | Name | Type | Description |
|---|------|------|-------------|
| 1 | Reconnaissance | single | Map codebase, measure generator's share of pipeline time |
| 2 | Rust Infrastructure | single | Cargo workspace, napi-rs, build scripts, CI, prebuild |
| 3 | Direct Port | single | Scaffold + direct file-by-file TS-to-Rust translation |
| 4 | Fix Tests | loop | Fix tests until 100% pass with BABEL_RUST_GENERATOR=1 |
| 5 | Benchmark + Profile | single | Benchmark harness + deep TS profiling + hypotheses |
| 6 | Rust Kernels | single | Rust kernel replacements for TS hotspots (Buffer, etc.) |
| 7 | Strategy Comparison | single | AST marshaling strategy exploration + comparison |
| 8 | Optimize | loop | Optimize until 10x target met (or plateau) |
| 9 | Release Packaging | single | Platform packages, CI prebuild, docs |

Check PHASES.md for full instructions per phase. Check progress log for current phase.

## Progress log

The in-repo progress log is at `packages/babel-generator/RUST_PORT_PROGRESS_LOG.md`.
Append entries there after meaningful work: date, what was done, test results,
benchmark numbers, commit refs.

## Git

- Branch: `rust/generator-port` (linear history)
- Remote: https://github.com/motiz88/babel
- Push after meaningful commits: `git push origin rust/generator-port`
