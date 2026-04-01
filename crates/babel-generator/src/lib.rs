use napi::bindgen_prelude::*;
use napi::{JsFunction, JsObject, JsString, JsUnknown};
use napi_derive::napi;

/// Generate code from a Babel AST.
///
/// This is currently a pass-through stub that calls back into the JS
/// implementation. It will be replaced with a full Rust implementation.
#[napi]
pub fn generate(
    _env: Env,
    ast: JsObject,
    opts: JsObject,
    code: JsString,
    js_generate: JsFunction,
) -> Result<JsUnknown> {
    let ast_unknown: JsUnknown = ast.into_unknown();
    let opts_unknown: JsUnknown = opts.into_unknown();
    let code_unknown: JsUnknown = code.into_unknown();
    js_generate.call(None, &[ast_unknown, opts_unknown, code_unknown])
}
