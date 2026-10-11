/**
 * Build-time fallback for the generated wasm-pack module. `pnpm wasm:build`
 * writes the concrete JavaScript, WebAssembly, and declarations to this path.
 */
declare module '@terrane-labs/slope-wasm-core' {
  export default function init(): Promise<unknown>;
  export function boundary_probe(): string;
}
