# Rust Port Progress Log

## 2026-04-01 — Phase 1: Reconnaissance (Complete)

### What was done
- Reset branch onto upstream/main (babel/babel@b0e3517, Babel 8.0.0-rc.3, March 2026)
- Read all 20 source files (TypeScript, ~6,600 lines)
- Mapped dependency graph and external dependencies
- Documented public API surface
- Inventoried test suite: 1735 tests across 4 suites, all passing
- Measured pipeline impact: generator is median 34.5% of parse+generate time
- Noted key architectural differences from old codebase (buffer rewrite, charcode dispatch, bitflags, TokenMap)

### Test baseline
```
NODE_OPTIONS="--experimental-strip-types" yarn jest packages/babel-generator --watchman=false
4 suites, 1735 tests, 23 snapshots, 0 failures, ~1.5s
```

### Pipeline impact summary
- **Parse+generate only**: generator is 31-37% (median 34.5%), down from 68.8% in v7.10
- **Full pipeline (parse+transform+generate)**: generator is only **3-8%** (median ~7%)
  - Transform dominates at 73-82% (even with just TS type stripping)
  - Parse is 12-20%
- 10x generator speedup → only 1.03-1.08x full-pipeline speedup (Amdahl's law)
- Generator-only speedup is the meaningful metric for this port
- AST marshaling overhead is critical — must be near-zero to not negate gains

### Phase 2: Rust Infrastructure (Complete)
- Cargo workspace at crates/ with babel-napi-utils and babel-generator
- Pass-through stub with feature toggle
- 1735 tests pass in both toggle states
- Commits: 47562a9, e8dbff4

### Current phase
Phase 1 & 2 complete. Ready for Phase 3: Direct Port.
