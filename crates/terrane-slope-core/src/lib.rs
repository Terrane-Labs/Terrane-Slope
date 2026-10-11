//! Rust/WASM boundary for future deterministic computational kernels.
//!
//! Phase 0.1 exposes no geotechnical algorithms. The probe is intentionally
//! small and verifies that browser bindings can call into this crate.

use wasm_bindgen::prelude::*;

/// Minimal exported contract used to verify the TypeScript/WASM boundary.
#[wasm_bindgen]
pub fn boundary_probe() -> String {
    "terrane-slope-core:ready".to_owned()
}

#[cfg(test)]
mod tests {
    use super::boundary_probe;

    #[test]
    fn boundary_probe_is_stable() {
        assert_eq!(boundary_probe(), "terrane-slope-core:ready");
    }
}
