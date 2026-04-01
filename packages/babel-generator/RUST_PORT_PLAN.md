# @babel/generator Rust Port: Reconnaissance & Plan

## Build & Test Infrastructure Summary

### Monorepo Structure
- **Package manager**: Yarn 4 (Berry) with node-modules linker
- **Build system**: `Makefile.js` (compiled from `Makefile.source.ts`), replaces old Gulp pipeline
- **Test runner**: Jest with `jest-light-runner`, configured via `jest.config.ts`
- **Language**: TypeScript (.ts files throughout)
- **Build command**: `NODE_OPTIONS="--experimental-strip-types" make build-no-bundle`
- **Test command**: `NODE_OPTIONS="--experimental-strip-types" yarn jest packages/babel-generator --watchman=false`
- **Node.js**: `^20.19.0 || >=22.12.0`
- **Babel version**: 8.0.0-rc.3
- **Package type**: ESM (`"type": "module"`)

### No existing native/compiled dependencies in the Babel repo.

---

## File Inventory

### Source Files (20 files, ~6,600 unique lines)

| File | Lines | Description |
|------|------:|-------------|
| `src/index.ts` | 249 | Entry point, `generate()`, `normalizeOptions()`, `GeneratorOptions` interface |
| `src/printer.ts` | 1443 | `Printer` class — core printing, comments, indentation, bitflag state |
| `src/buffer.ts` | 373 | `Buffer` class — string output, position tracking, source map marks |
| `src/source-map.ts` | 156 | `SourceMap` class — uses `@jridgewell/gen-mapping` and `trace-mapping` |
| `src/token-map.ts` | 241 | `TokenMap` class — maps AST nodes to input tokens for `preserveFormat` |
| `src/nodes.ts` | 29 | `generatorInfosMap` — sorted map of node type → [printer, id, parens handler] |
| `src/node/index.ts` | 111 | `parentNeedsParens`, `isLastChild`, `TokenContext` enum |
| `src/node/parentheses.ts` | 622 | Parenthesization rules per node type (heavily uses `__node()` dispatch) |
| `src/generators/index.ts` | 11 | Re-exports all generator modules |
| `src/generators/base.ts` | 100 | `File`, `Program`, `BlockStatement`, `Directive`, `DirectiveLiteral` |
| `src/generators/expressions.ts` | 353 | Expression printers (unary, binary, call, member, etc.) |
| `src/generators/statements.ts` | 354 | Statement printers (if, for, while, switch, var, etc.) |
| `src/generators/classes.ts` | 298 | Class declarations, properties, methods, `StaticBlock`, `ClassAccessorProperty` |
| `src/generators/methods.ts` | 336 | Function heads, params, arrow functions, `_shouldPrintArrowParamsParens` |
| `src/generators/modules.ts` | 318 | Import/export declarations, `ImportExpression`, import attributes |
| `src/generators/types.ts` | 217 | Literals, identifiers, object/array expressions, `TopicReference` |
| `src/generators/flow.ts` | 797 | Flow type annotation printers |
| `src/generators/typescript.ts` | 807 | TypeScript type annotation printers |
| `src/generators/jsx.ts` | 131 | JSX element/attribute printers |
| `src/generators/template-literals.ts` | 43 | Template literal printers (new batched approach) |

### Key Changes from Old Codebase (v7.10)
1. **TypeScript** instead of Flow-typed JS
2. **Buffer rewrite**: No more queue/array-of-strings. Single `_buf + _str` string accumulation with charcode-based `_last` tracking
3. **`const enum` bitflags**: `PRINTER_FLAGS`, `LAST_CHAR_KINDS`, `COMMENT_TYPE`, `TokenContext`, etc.
4. **`TokenMap`** (241 lines): New file for `experimental_preserveFormat` — maps nodes to input tokens
5. **`nodes.ts`**: Centralized `generatorInfosMap` with numeric IDs for each node type (enables `__node()` integer dispatch)
6. **`charcodes` inline**: Uses charcode constants instead of string comparisons
7. **Source maps**: Uses `@jridgewell/gen-mapping` + `@jridgewell/trace-mapping` instead of `source-map`
8. **`lodash` removed**: No more `isInteger`, `repeat` dependencies
9. **`whitespace.js` removed**: Whitespace logic merged into printer
10. **Printer is ~2.2x larger** (1443 vs 659 lines) with significantly more sophisticated comment handling

### Dependency Graph

```
index.ts
├── printer.ts
│   ├── buffer.ts
│   │   └── source-map.ts (@jridgewell/gen-mapping, @jridgewell/trace-mapping)
│   ├── token-map.ts (@babel/types: traverseFast, VISITOR_KEYS)
│   ├── node/index.ts
│   │   └── node/parentheses.ts (@babel/types)
│   ├── nodes.ts
│   │   └── generators/index.ts (re-exports all below)
│   │       ├── generators/base.ts
│   │       ├── generators/expressions.ts (@babel/types, charcodes, TokenContext)
│   │       ├── generators/statements.ts (@babel/types, charcodes, TokenContext)
│   │       ├── generators/classes.ts (@babel/types, charcodes)
│   │       ├── generators/methods.ts (@babel/types, charcodes, TokenContext)
│   │       ├── generators/modules.ts (@babel/types, TokenContext)
│   │       ├── generators/types.ts (@babel/types, jsesc, charcodes)
│   │       ├── generators/flow.ts (@babel/types)
│   │       ├── generators/typescript.ts (@babel/types)
│   │       ├── generators/jsx.ts
│   │       └── generators/template-literals.ts
│   ├── charcodes (inline)
│   └── jsesc
└── source-map.ts
```

### External Dependencies
| Package | Usage |
|---------|-------|
| `@babel/types` | Node type checking, `VISITOR_KEYS`, `traverseFast` |
| `@babel/parser` | `Token` type (for `TokenMap`) |
| `jsesc` | String escaping for `StringLiteral`, `NumericLiteral` |
| `charcodes` | Character code constants (inlined) |
| `@jridgewell/gen-mapping` | Source map generation |
| `@jridgewell/trace-mapping` | Input source map reading |

---

## Public API Surface

### Default/Named Export: `generate(ast, opts?, code?) → GeneratorResult`

### `GeneratorOptions` (interface)
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `auxiliaryCommentBefore` | string | — | Block comment before auxiliary nodes |
| `auxiliaryCommentAfter` | string | — | Block comment after auxiliary nodes |
| `shouldPrintComment` | function | — | Predicate to filter comments |
| `experimental_preserveFormat` | boolean | false | Preserve input formatting (requires `retainLines`, `tokens`) |
| `retainLines` | boolean | false | Keep output on same lines as input |
| `retainFunctionParens` | boolean | false | Retain parens around function expressions |
| `comments` | boolean | true | Include comments |
| `compact` | boolean\|"auto" | false | Remove whitespace; "auto" if > 500KB |
| `minified` | boolean | false | Compact + remove semicolons |
| `concise` | boolean | false | Reduce whitespace |
| `filename` | string | — | For compact="auto" warning |
| `sourceMaps` | boolean | false | Enable source maps |
| `inputSourceMap` | any | — | Input source map for remapping |
| `sourceRoot` | string | — | Source root for maps |
| `sourceFileName` | string | — | Source file name |
| `jsescOption` | object | `{quotes:"double",wrap:true,minimal:true}` | `jsesc` options |
| `topicToken` | string | — | Hack pipe topic token |

### `GeneratorResult` (interface)
```typescript
{ code: string; map: EncodedSourceMap | null; decodedMap: DecodedSourceMap | undefined; rawMappings: Mapping[] | undefined; }
```

---

## Test Suite Inventory

### Test Files
| File | Tests | Description |
|------|------:|-------------|
| `test/index.js` | ~1650 | Main test suite: fixtures + programmatic tests |
| `test/arrow-functions.js` | ~20 | Arrow function edge cases |
| `test/preserve-format.js` | ~50 | `experimental_preserveFormat` tests |
| `test/printer.skip-bundled.js` | ~15 | Printer-specific tests |
| **Total** | **1735** | |

### Test Baseline
```
NODE_OPTIONS="--experimental-strip-types" yarn jest packages/babel-generator --watchman=false
4 suites, 1735 tests, 23 snapshots, 0 failures, ~1.5s execution
```

---

## Pipeline Impact Assessment

### Parse + Generate Only (100 iterations, medians)

| Workload | Bytes | Parse ms | Gen ms | Total ms | Gen% |
|----------|------:|---------:|-------:|---------:|-----:|
| parser expression.ts (99KB) | 99,386 | 5.07 | 2.27 | 7.34 | 31.0% |
| types validators (191KB) | 191,338 | 10.06 | 4.94 | 15.01 | 32.9% |
| generator printer.ts (40KB) | 40,312 | 1.72 | 0.93 | 2.65 | 35.2% |
| generator typescript.ts (19KB) | 19,012 | 0.86 | 0.47 | 1.33 | 35.3% |
| parser tokenizer (47KB) | 47,097 | 1.87 | 1.04 | 2.91 | 35.8% |

Generator is **31-36% of parse+generate** (median 34.5%, down from 68.8% in v7.10).

### Full Pipeline: Parse + Transform + Generate (50 iterations, medians)

| Workload | Bytes | Parse ms | Transform ms | Gen ms | Total ms | P% | X% | G% | @10x |
|----------|------:|---------:|-------------:|-------:|---------:|---:|---:|---:|-----:|
| parser expression.ts (99KB) | 99,386 | 6.99 | 25.37 | 2.37 | 34.74 | 20% | 73% | 7% | 1.07 |
| types validators (191KB) | 191,338 | 10.90 | 62.00 | 2.26 | 75.16 | 14% | 82% | 3% | 1.03 |
| generator printer.ts (40KB) | 40,312 | 3.42 | 15.05 | 1.69 | 20.17 | 17% | 75% | 8% | 1.08 |
| generator typescript.ts (19KB) | 19,012 | 1.21 | 7.94 | 0.63 | 9.77 | 12% | 81% | 6% | 1.06 |
| parser tokenizer (47KB) | 47,097 | 3.15 | 15.06 | 1.49 | 19.69 | 16% | 76% | 8% | 1.07 |
| synthetic arrows (100 fns) | 3,480 | 0.59 | 2.23 | 0.24 | 3.05 | 19% | 73% | 8% | 1.08 |
| synthetic comments (100) | 4,260 | 0.22 | 0.95 | 0.11 | 1.27 | 17% | 75% | 8% | 1.08 |
| synthetic pseudo-JSX (50) | 3,065 | 0.41 | 1.51 | 0.16 | 2.08 | 20% | 73% | 8% | 1.07 |

Transform used: `@babel/preset-typescript` (TS type stripping) for .ts files, identity transform for .js files.

### Analysis

**Generator fraction of full pipeline**: **3-8%** (median ~7%).

**Transform dominates** at 73-82% of total pipeline time, even with minimal transforms (just TS type stripping). Parse is 12-20%. Generator is a single-digit fraction.

**Amdahl's law**: Even a 10x generator speedup yields only **1.03-1.08x** end-to-end improvement on the full pipeline. An infinitely fast generator would give at most 1.08x speedup.

**Key implications for the Rust port strategy**:

1. **Generator-only speedup is the meaningful metric.** End-to-end improvement from generator optimization alone is negligible. The value of a Rust generator is in isolation: faster `generate()` calls for use cases that call it directly (e.g., code formatting, AST manipulation tools, hot module replacement).

2. **AST marshaling overhead is critical.** If marshaling the AST to Rust costs even 1-2ms, it could negate the generator speedup entirely. The winning strategy must have near-zero marshaling overhead.

3. **Kernel replacements (Phase 6) remain viable.** Replacing hot internal components (buffer, source map encoding) avoids marshaling entirely and can speed up the TS generator without a full port.

4. **Full pipeline speedup requires porting more than just the generator.** To get meaningful end-to-end gains, the parser and/or transform pipeline would also need optimization.

---

## Architecture Notes

### Key Design Patterns (New)
1. **Integer dispatch**: `generatorInfosMap` assigns numeric IDs; `__node("TypeName")` returns the ID. Parentheses use `parentId` integers instead of string-based `t.isXxx()` checks
2. **Bitflag state**: `TokenContext` bitflags propagate through print calls (e.g., `forInHead | forInOrInitHeadAccumulate`)
3. **Charcode tracking**: `Buffer._last` stores last character's charcode (not a string). Comparisons use `charCodes.*` constants
4. **Single-string buffer**: `_buf + _str` with periodic flushing at 4096 appends (flatstr optimization)
5. **Queue simplified**: Only queues space or semicolon (single charcode, not arbitrary strings)
6. **`TokenMap` for preserveFormat**: Maps AST nodes to original token positions for format preservation

### Complexity Hotspots
1. **`printer.ts`** (1443 lines): Comment handling (~500 lines), print dispatch, terminatorless, indentation
2. **`node/parentheses.ts`** (622 lines): Complex parenthesization with `__node()` integer dispatch
3. **`generators/typescript.ts`** (807 lines) + **`generators/flow.ts`** (797 lines): Type system printers
4. **`buffer.ts`** (373 lines): Source position tracking, charcode-based state
5. **`token-map.ts`** (241 lines): Binary search over tokens, node-to-token mapping

---

## Open Questions / Risks

1. **Generator is only 3-8% of full pipeline** (parse+transform+generate). End-to-end impact is minimal. The Rust port's value is in generator-only speedup for direct `generate()` callers, or as groundwork for porting more of the pipeline.

2. **`__node()` global function**: The codebase uses `declare global { function __node(type: string): number; }` — this is likely compile-time-replaced. Need to understand how this works for the Rust port.

3. **`const enum` usage**: Extensive use of `const enum` for bitflags. These are erased at compile time and replaced with literal values. The Rust port should use equivalent `const` or bitflag patterns.

4. **`TokenMap` complexity**: The `preserveFormat` feature adds significant complexity. Could be deferred initially.

5. **Source maps**: Now uses `@jridgewell/gen-mapping` instead of `source-map`. The API is different but the concept is the same.

6. **ESM package**: The package is `"type": "module"` with ESM imports. The native loader uses a CJS file (`native.cjs`) to `require()` the `.node` addon.
