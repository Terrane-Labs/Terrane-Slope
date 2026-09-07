## Summary of Changes

Provide a brief summary of the changes introduced by this pull request and the rationale behind them.

## Related Issues

Closes #(issue_number)

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Mathematical / geotechnical core refinement
- [ ] Performance improvement or optimization
- [ ] Refactoring (no functional changes)
- [ ] Documentation update
- [ ] CI/CD or tooling enhancement

## Architectural Compliance

- [ ] **UI / Domain Separation:** Visual components in `packages/ui` or `apps/web` do NOT own scientific algorithms (ADR-005).
- [ ] **Coordinate Conventions:** Adheres to right-handed ENU (+X East, +Y North, +Z Up) and Wulff lower-hemisphere stereonet projection (ADR-007, ADR-008).
- [ ] **Deterministic Computation:** No non-deterministic floating point behavior, unseeded randomness, or side effects in numerical routines (ADR-006).
- [ ] **Dependency Boundaries:** Core packages do not import from consumer applications.

## Verification Checklist

- [ ] `pnpm format:check` passes without errors
- [ ] `pnpm wasm:build` compiles successfully
- [ ] `pnpm lint` and `cargo clippy` pass with zero warnings
- [ ] `pnpm typecheck` passes across all workspace packages
- [ ] `pnpm test` (unit tests) pass
- [ ] `pnpm test:e2e` (Playwright browser tests) pass
- [ ] Full `pnpm verify` passes locally
