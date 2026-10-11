/**
 * Invokes the wasm-pack binding generated from terrane-slope-core.
 * The alias keeps generated output behind this application-facing boundary.
 */
export async function readCoreBoundary(): Promise<string> {
  const wasm = await import('@terrane-labs/slope-wasm-core');
  await wasm.default();
  return wasm.boundary_probe();
}
