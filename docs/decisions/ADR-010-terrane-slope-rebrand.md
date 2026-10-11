# ADR-010: Terrane Slope identity and workspace naming

## Status

Accepted

## Context

The project began as GeoKinematics-3D. It now ships under the product name Terrane Slope, part of the Terrane Labs umbrella. The old name tied the product to one analysis type and does not fit later work under the same organization.

## Decision

- The product is **Terrane Slope**. Terrane Labs is the organization that owns it.
- Workspace packages use the `@terrane-labs/*` scope and keep their existing roles: `domain`, `geometry`, `kinematics`, `ui`, `terrain`, `numerics`. The application package is `@terrane-labs/slope-web`.
- The Rust crate is `terrane-slope-core`. `wasm-pack` writes `terrane_slope_core` into `apps/web/src/lib/wasm/generated/`.
- The TypeScript alias `@terrane-labs/slope-wasm-core` resolves to that generated module. It is a `tsconfig` path alias, not a published package.
- The runtime boundary probe returns `terrane-slope-core:ready`.
- The canonical repository is `Terrane-Labs/terrane-slope`.

## Consequences

- Earlier ADRs keep their original wording. ADR-003 refers to `geokinematics-core` and ADR-009 refers to `@geokinematics/kinematics`; those names map to `terrane-slope-core` and `@terrane-labs/kinematics`.
- No scientific behavior, coordinate convention, or tolerance changed.
- The repository moved from `nabielnovelkhubran/GeoKinematics-3D` to `Terrane-Labs/Terrane-Slope`. A follow-up commit updated `package.json` (`homepage`, `repository`), `Cargo.toml` (`repository`), the README CI badge, and the `CONTRIBUTING.md` clone instructions. The README RepoGrade badge was removed because RepoGrade reports the new repository as not graded.
- No shared core or second product package exists yet. A shared computational-geoscience core remains an Architectural Direction.
