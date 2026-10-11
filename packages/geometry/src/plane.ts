import type { Degrees, PlaneOrientation, Vector3 } from '@terrane-labs/domain';
import { degreesToRadians, normalizeAzimuth, radiansToDegrees } from './angle';
import { CANONICAL_EPSILON } from './tolerance';
import {
  vec3AreParallel,
  vec3Cross,
  vec3Dot,
  vec3Magnitude,
  vec3Negate,
  vec3Normalize,
} from './vector';

// ── Private helpers ─────────────────────────────────────────────────────────

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite.`);
}

function zeroSmallComponents(vector: Vector3): Vector3 {
  return {
    x: Math.abs(vector.x) <= CANONICAL_EPSILON ? 0 : vector.x,
    y: Math.abs(vector.y) <= CANONICAL_EPSILON ? 0 : vector.y,
    z: Math.abs(vector.z) <= CANONICAL_EPSILON ? 0 : vector.z,
  };
}

const RIGHT_ANGLE_DEGREES = 90;

// ── Phase 1A orientation functions (moved from index.ts) ────────────────────

/**
 * Validates and canonicalizes a plane orientation.
 *
 * A horizontal plane has undefined dip direction; it is represented as 0°
 * solely for deterministic storage and has no geological directional meaning.
 */
export function normalizePlaneOrientation(orientation: PlaneOrientation): PlaneOrientation {
  assertFinite(orientation.dip, 'Dip');
  if (orientation.dip < 0 || orientation.dip > RIGHT_ANGLE_DEGREES) {
    throw new RangeError('Dip must be within [0°, 90°].');
  }
  const dipDirection = normalizeAzimuth(orientation.dipDirection);
  if (Math.abs(orientation.dip) <= CANONICAL_EPSILON) return { dipDirection: 0, dip: 0 };
  return { dipDirection, dip: orientation.dip };
}

/**
 * Returns the deterministic representative of an unoriented plane normal.
 * Prefer z > 0; when z is approximately zero prefer x > 0; when x is also
 * approximately zero prefer y >= 0. This makes vertical-plane handling stable.
 */
export function canonicalizeNormal(normal: Vector3): Vector3 {
  const normalized = vec3Normalize(normal); // throws for near-zero
  const isNegativeHemisphere =
    normalized.z < -CANONICAL_EPSILON ||
    (Math.abs(normalized.z) <= CANONICAL_EPSILON && normalized.x < -CANONICAL_EPSILON) ||
    (Math.abs(normalized.z) <= CANONICAL_EPSILON &&
      Math.abs(normalized.x) <= CANONICAL_EPSILON &&
      normalized.y < 0);
  return zeroSmallComponents(isNegativeHemisphere ? vec3Negate(normalized) : normalized);
}

/** Returns the horizontal strike vector using the right-hand relation with the down-dip vector. */
export function planeStrikeVector(orientation: PlaneOrientation): Vector3 {
  const { dipDirection } = normalizePlaneOrientation(orientation);
  const azimuth = degreesToRadians(dipDirection);
  return { x: -Math.cos(azimuth), y: Math.sin(azimuth), z: 0 };
}

/** Returns the unit vector pointing down the plane in its dip direction. */
export function planeDownDipVector(orientation: PlaneOrientation): Vector3 {
  const { dipDirection, dip } = normalizePlaneOrientation(orientation);
  const azimuth = degreesToRadians(dipDirection);
  const dipRadians = degreesToRadians(dip);
  return {
    x: Math.sin(azimuth) * Math.cos(dipRadians),
    y: Math.cos(azimuth) * Math.cos(dipRadians),
    z: -Math.sin(dipRadians),
  };
}

/** Returns the upward-canonical unit normal derived from dip direction and dip. */
export function planeNormalFromOrientation(orientation: PlaneOrientation): Vector3 {
  const { dipDirection, dip } = normalizePlaneOrientation(orientation);
  const azimuth = degreesToRadians(dipDirection);
  const dipRadians = degreesToRadians(dip);
  return canonicalizeNormal({
    x: Math.sin(dipRadians) * Math.sin(azimuth),
    y: Math.sin(dipRadians) * Math.cos(azimuth),
    z: Math.cos(dipRadians),
  });
}

/**
 * Derives the canonical dip-direction/dip representation from a plane normal.
 * For a horizontal plane, dip direction is returned as 0° for deterministic
 * representation only; it has no geological directional meaning.
 */
export function planeOrientationFromNormal(normal: Vector3): PlaneOrientation {
  const canonical = canonicalizeNormal(normal);
  const dip = radiansToDegrees(Math.acos(Math.min(1, Math.max(-1, canonical.z))));
  if (dip <= CANONICAL_EPSILON) return { dipDirection: 0, dip: 0 };
  return {
    dipDirection: normalizeAzimuth(radiansToDegrees(Math.atan2(canonical.x, canonical.y))),
    dip,
  };
}

/** Converts an arbitrary orientation to its deterministic plane representation. */
export function canonicalizePlaneOrientation(orientation: PlaneOrientation): PlaneOrientation {
  return planeOrientationFromNormal(planeNormalFromOrientation(orientation));
}

// ── Phase 1B: Plane type and pure geometric API ─────────────────────────────

/**
 * A mathematical plane defined by a point on the plane and a canonicalized unit normal.
 *
 * Invariant: `normal` is a unit vector canonicalized via `canonicalizeNormal`.
 * Construct using `planeFromPointNormal` to enforce this invariant.
 * Plane relational functions rely on this invariant and do not re-canonicalize.
 *
 * @see planeFromPointNormal
 */
export interface Plane {
  readonly point: Vector3;
  readonly normal: Vector3;
}

/**
 * Constructs a `Plane` from a point and a normal vector.
 *
 * The provided normal is normalized and canonicalized using the Phase 1A rule
 * (prefer z > 0; tie-break on x, then y), ensuring the unit-normal invariant
 * of `Plane` is satisfied.
 *
 * @throws {RangeError} if `normal` is near-zero (magnitude ≤ CANONICAL_EPSILON).
 */
export function planeFromPointNormal(point: Vector3, normal: Vector3): Plane {
  // canonicalizeNormal calls vec3Normalize internally, which throws for near-zero.
  return { point, normal: canonicalizeNormal(normal) };
}

/**
 * Returns true if the normals of planes a and b are parallel or anti-parallel.
 *
 * Relies on the `Plane` unit-normal invariant; no additional canonicalization
 * is applied. Because `planeFromPointNormal` canonicalizes normals, two planes
 * with originally opposite normals will have identical canonical normals and
 * this function will return true.
 */
export function planeAreParallel(a: Plane, b: Plane): boolean {
  return vec3AreParallel(a.normal, b.normal);
}

/**
 * Returns true if the normals of planes a and b are perpendicular,
 * i.e. |a.normal · b.normal| < CANONICAL_EPSILON.
 */
export function planeAreOrthogonal(a: Plane, b: Plane): boolean {
  return Math.abs(vec3Dot(a.normal, b.normal)) < CANONICAL_EPSILON;
}

/**
 * Returns the unit direction vector of the line of intersection of two non-parallel planes,
 * computed as normalize(a.normal × b.normal).
 *
 * @throws {RangeError} if the planes are parallel (‖a.normal × b.normal‖ ≤ CANONICAL_EPSILON).
 */
export function planeIntersectionLine(a: Plane, b: Plane): Vector3 {
  const direction = vec3Cross(a.normal, b.normal);
  if (vec3Magnitude(direction) <= CANONICAL_EPSILON) {
    throw new RangeError('Cannot compute the intersection of parallel planes.');
  }
  return vec3Normalize(direction);
}

/**
 * Returns true if `dir` is parallel to the plane, i.e. perpendicular to the plane's normal:
 * |plane.normal · normalize(dir)| < CANONICAL_EPSILON.
 *
 * The check is scale-invariant because `dir` is normalized before the dot product.
 *
 * @throws {RangeError} if `dir` is near-zero.
 */
export function planeContainsDirection(plane: Plane, dir: Vector3): boolean {
  const unitDir = vec3Normalize(dir); // throws if near-zero
  return Math.abs(vec3Dot(plane.normal, unitDir)) < CANONICAL_EPSILON;
}
