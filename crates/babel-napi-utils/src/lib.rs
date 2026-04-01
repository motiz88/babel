use napi::bindgen_prelude::*;
use napi::{JsObject, JsUnknown, ValueType};

/// Helper to get a property from a JsObject by key.
/// Returns Ok(None) if the property is undefined or null.
pub fn get_prop(_env: &Env, obj: &JsObject, key: &str) -> Result<Option<JsUnknown>> {
    if !obj.has_named_property(key)? {
        return Ok(None);
    }
    let val: JsUnknown = obj.get_named_property(key)?;
    match val.get_type()? {
        ValueType::Undefined | ValueType::Null => Ok(None),
        _ => Ok(Some(val)),
    }
}

/// Helper to get a string property from a JsObject.
pub fn get_string_prop(env: &Env, obj: &JsObject, key: &str) -> Result<Option<String>> {
    match get_prop(env, obj, key)? {
        Some(val) => {
            let s = val.coerce_to_string()?;
            Ok(Some(s.into_utf8()?.as_str()?.to_owned()))
        }
        None => Ok(None),
    }
}

/// Helper to get a boolean property from a JsObject, defaulting to false.
pub fn get_bool_prop(env: &Env, obj: &JsObject, key: &str) -> Result<bool> {
    match get_prop(env, obj, key)? {
        Some(val) => {
            let b = val.coerce_to_bool()?;
            Ok(b.get_value()?)
        }
        None => Ok(false),
    }
}

/// Helper to get a numeric property from a JsObject.
pub fn get_number_prop(env: &Env, obj: &JsObject, key: &str) -> Result<Option<f64>> {
    match get_prop(env, obj, key)? {
        Some(val) => {
            let n = val.coerce_to_number()?;
            Ok(Some(n.get_double()?))
        }
        None => Ok(None),
    }
}

/// Check if the Rust implementation should be used, based on environment
/// variable or options flag.
///
/// Checks (in order):
/// 1. `opts.useNative` (if opts is provided)
/// 2. `BABEL_RUST_GENERATOR=1` environment variable
pub fn should_use_rust(env: &Env, opts: Option<&JsObject>) -> Result<bool> {
    // Check options flag first
    if let Some(opts) = opts {
        if get_bool_prop(env, opts, "useNative")? {
            return Ok(true);
        }
    }

    // Check environment variable
    match std::env::var("BABEL_RUST_GENERATOR") {
        Ok(val) => Ok(val == "1" || val == "true"),
        Err(_) => Ok(false),
    }
}

/// Convert a Rust error message into a napi::Error.
pub fn babel_error(msg: impl Into<String>) -> Error {
    Error::new(Status::GenericFailure, msg.into())
}
