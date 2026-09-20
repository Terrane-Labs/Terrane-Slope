# Architecture

## Boundaries

- `apps/web` is the Next.js presentation shell and owns browser integration only.
- `packages/domain` defines portable domain vocabulary; the remaining package directories reserve independent scientific capabilities.
- `packages/geometry` owns pure ENU transforms, stereonet projection, and deterministic normal canonicalization.
- `packages/kinematics` owns kinematic admissibility evaluation (planar sliding, wedge sliding, direct toppling). Imports from `geometry` and `domain`. No React or browser dependencies.
- `packages/ui` contains reusable React presentation components only.
- `crates/geokinematics-core` owns performance-sensitive, deterministic computation exposed to the browser through WebAssembly.
- Packages never import applications. Scientific/domain code never imports React.

## Coordinate and orientation contract

`packages/domain` owns framework-independent coordinate/orientation types and
their units. `packages/geometry` owns pure ENU transforms and deterministic
normal canonicalization. Neither package depends on React, Three.js, or an app.

## WebAssembly boundary

Rust exposes an intentionally tiny `boundary_probe` function through `wasm-bindgen`. The browser adapter in `apps/web/src/lib/wasm/core.ts` is the only application-facing contract. `pnpm wasm:build` regenerates its implementation using `wasm-pack`; generated output is not committed.

No service, database, or server-side scientific computation is part of this architecture.
