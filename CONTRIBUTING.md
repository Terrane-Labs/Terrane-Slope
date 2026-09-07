# Contributing to GeoKinematics-3D

Thank you for your interest in contributing to **GeoKinematics-3D**! This project is a specialized computational platform for rock-slope kinematic analysis, combining geological coordinate geometry, equal-angle stereonet projections, 3D visualization, and WebAssembly computation.

To preserve scientific rigor, mathematical stability, and architectural clarity, please read this guide thoroughly before submitting contributions.

---

## Architectural Principles

GeoKinematics-3D enforces strict boundaries between domain types, pure geometry, kinematic evaluation, and presentation layers:

1. **Scientific Logic Isolation:** All geological and geometric mathematics reside in `packages/*` and `crates/*`. User interface components in `apps/web` and `packages/ui` present data and handle user interactions, but must never own or alter scientific algorithms (see ADR-005).
2. **Direction of Dependencies:** Packages must never import from an application. `packages/kinematics` imports from `packages/geometry` and `packages/domain`. `packages/ui` imports from `packages/geometry` and `packages/domain`. Applications consume packages.
3. **Coordinate Conventions:** All vector mathematics adhere strictly to right-handed East-North-Up (ENU: +X East, +Y North, +Z Up) coordinates. Stereonets use the Wulff lower-hemisphere equal-angle projection with downward-positive plunge (see ADR-007 and ADR-008).
4. **Deterministic Computation:** Numerical algorithms must be completely deterministic across platforms (see ADR-006).

---

## Development Setup

### Prerequisites

Ensure you have the following tools installed on your development machine:

- **Node.js:** Version 22 LTS (`.nvmrc` is provided; run `nvm use` if using nvm).
- **pnpm:** Version 11.16+ (`corepack enable pnpm` or `npm install -g pnpm@11.16.0`).
- **Rust:** Stable toolchain (`rustup default stable`).
- **WebAssembly Target:** `rustup target add wasm32-unknown-unknown`.
- **wasm-pack:** `cargo install wasm-pack --locked`.
- **Operating System:** Windows, macOS, or Linux. Ensure `%USERPROFILE%\.cargo\bin` (Windows) or `$HOME/.cargo/bin` (macOS/Linux) is present in your system `PATH`.

### Initializing the Environment

1. Clone your fork of the repository:

   ```sh
   git clone https://github.com/<your-username>/GeoKinematics-3D.git
   cd GeoKinematics-3D
   ```

2. Install all workspace dependencies:

   ```sh
   pnpm install
   ```

3. Install Playwright browser binaries for end-to-end testing:

   ```sh
   pnpm exec playwright install chromium
   ```

4. Build the WebAssembly computational core:

   ```sh
   pnpm wasm:build
   ```

5. Launch the local development server:
   ```sh
   pnpm dev
   ```
   Open `http://localhost:3000` in your web browser to view the application.

---

## Code Style & Formatting

We maintain strict automated linting and formatting across both TypeScript and Rust:

- **TypeScript / Markdown / JSON / CSS:** Formatted via **Prettier** and linted with **ESLint 9**.
  - Check formatting: `pnpm format:check`
  - Auto-format files: `pnpm format`
  - Lint TypeScript: `pnpm lint`
  - Type-check TypeScript: `pnpm typecheck`
- **Rust:** Formatted via **rustfmt** and linted with **clippy** with warnings denied (`-D warnings`).
  - Check Rust formatting: `cargo fmt --check`
  - Run clippy: `cargo clippy --workspace --all-targets --all-features -- -D warnings`

Always ensure your changes produce zero ESLint warnings and zero Rust clippy warnings.

---

## Running Tests

GeoKinematics-3D includes multi-layered test suites that must pass before any change is merged:

1. **TypeScript Unit Tests (Vitest):** Tests vector math, stereonet projection, and kinematic analysis.
   ```sh
   pnpm test
   ```
2. **Rust Core Tests:** Verifies deterministic WASM probes and mathematical algorithms.
   ```sh
   cargo test --workspace
   ```
3. **Browser End-to-End Tests (Playwright):** Verifies WebAssembly loading, Three.js canvas rendering, and stereonet interactions.
   ```sh
   pnpm test:e2e
   ```
4. **Comprehensive Verification:** Executes the full CI verification pipeline locally:
   ```sh
   pnpm verify
   ```

---

## Pull Request Workflow

1. **Create an Issue:** Before submitting significant features or architectural changes, please open an issue using the appropriate issue template to discuss the design and mathematical basis.
2. **Create a Feature Branch:** Create a branch from `main` with a descriptive name:
   ```sh
   git checkout -b feat/planar-sliding-envelope
   # or
   git checkout -b fix/stereonet-azimuth-wrap
   ```
3. **Make Atomic Commits:** Follow [Conventional Commits](https://www.conventionalcommits.org/) conventions:
   - `feat(kinematics): add direct toppling kinematic check`
   - `fix(geometry): resolve edge case in line orientation unprojection`
   - `docs(readme): clarify coordinate convention examples`
4. **Verify Locally:** Run `pnpm verify` before pushing. Every check must pass.
5. **Open a Pull Request:** Push your branch to your GitHub fork and open a pull request against `main`. Fill out the provided pull request template with a summary, architectural checklist, and test results.
6. **Code Review:** Automated CI checks will run on your PR. Maintainers will review your code for mathematical validity, test coverage, and code cleanliness.

---

## Code of Conduct

All contributors and participants are expected to adhere to our [Code of Conduct](.github/CODE_OF_CONDUCT.md). Please report any unacceptable behavior to `nabielnovelkhubran@gmail.com`.
