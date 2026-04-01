// Native Rust addon loader for @babel/generator.
// This is a CJS file because require() is needed to load .node addons.
// Returns the binding object on success, or false if unavailable.

let nativeBinding = undefined;

function loadNativeBinding() {
  if (nativeBinding !== undefined) return nativeBinding;

  const path = require("path");

  const candidates = [
    path.resolve(
      __dirname,
      "../../../crates/target/release/babel_generator.node",
    ),
    path.resolve(
      __dirname,
      "../../../crates/target/debug/babel_generator.node",
    ),
  ];

  const errors = [];
  for (const candidate of candidates) {
    try {
      nativeBinding = require(candidate);
      return nativeBinding;
    } catch (e) {
      errors.push(`${candidate}: ${e.message}`);
    }
  }

  console.error(
    "[BABEL] Failed to load native generator addon. Tried:\n" +
      errors.map(e => `  - ${e}`).join("\n"),
  );
  nativeBinding = false;
  return false;
}

module.exports = { loadNativeBinding };
