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
- Generator fraction: 31-37% of parse+generate (median 34.5%)
- Significantly lower than v7.10 (68.8%) due to generator optimizations in v8
- 10x generator speedup → only 1.4-1.5x end-to-end speedup
- Parser now dominates at ~65% of pipeline time
- Strategy implications: kernel replacements or low-overhead marshaling even more important

### Phase 2: Rust Infrastructure (Complete)
- Cargo workspace at crates/ with babel-napi-utils and babel-generator
- Pass-through stub with feature toggle
- 1735 tests pass in both toggle states
- Commits: 47562a9, e8dbff4

### Current phase
Phase 1 & 2 complete. Ready for Phase 3: Direct Port.
