import type { Degrees, Radians } from '@terrane-labs/domain';

const FULL_CIRCLE_DEGREES = 360;

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite.`);
}

/** Converts decimal degrees to radians. */
export function degreesToRadians(degrees: Degrees): Radians {
  assertFinite(degrees, 'Degrees');
  return (degrees * Math.PI) / 180;
}

/** Converts radians to decimal degrees. */
export function radiansToDegrees(radians: Radians): Degrees {
  assertFinite(radians, 'Radians');
  return (radians * 180) / Math.PI;
}

/** Normalizes a clockwise-from-north azimuth to the half-open interval [0°, 360°). */
export function normalizeAzimuth(azimuth: Degrees): Degrees {
  assertFinite(azimuth, 'Azimuth');
  const normalized = ((azimuth % FULL_CIRCLE_DEGREES) + FULL_CIRCLE_DEGREES) % FULL_CIRCLE_DEGREES;
  return normalized === FULL_CIRCLE_DEGREES ? 0 : normalized;
}
