import type { Radians, Vector3 } from '@terrane-labs/domain';
import { CANONICAL_EPSILON } from './tolerance';

/** Right-handed East-North-Up basis for all Phase 1 geometry. */
export const ENU_BASIS = {
  east: { x: 1, y: 0, z: 0 },
  north: { x: 0, y: 1, z: 0 },
  up: { x: 0, y: 0, z: 1 },
} as const satisfies Record<'east' | 'north' | 'up', Vector3>;

// ── Primitive operations ────────────────────────────────────────────────────

/** Returns the Euclidean length of v. */
export function vec3Magnitude(v: Vector3): number {
  return Math.hypot(v.x, v.y, v.z);
}

/**
 * Returns the unit vector in the direction of v.
 * @throws {RangeError} if the magnitude of v is ≤ CANONICAL_EPSILON.
 */
export function vec3Normalize(v: Vector3): Vector3 {
  const len = vec3Magnitude(v);
  if (len <= CANONICAL_EPSILON) throw new RangeError('Cannot normalize a near-zero vector.');
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/** Returns the component-wise negation of v. */
export function vec3Negate(v: Vector3): Vector3 {
  return { x: -v.x, y: -v.y, z: -v.z };
}

// ── Arithmetic ──────────────────────────────────────────────────────────────

/** Returns the component-wise sum a + b. */
export function vec3Add(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

/** Returns the component-wise difference a − b. */
export function vec3Sub(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

/** Returns v scaled by scalar s. */
export function vec3Scale(v: Vector3, s: number): Vector3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

// ── Products ────────────────────────────────────────────────────────────────

/** Returns the dot product a · b. */
export function vec3Dot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** Returns the right-hand cross product a × b. */
export function vec3Cross(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

// ── Predicates ──────────────────────────────────────────────────────────────

/**
 * Returns true if v is a unit vector within CANONICAL_EPSILON,
 * i.e. |‖v‖ − 1| < CANONICAL_EPSILON.
 */
export function vec3IsUnit(v: Vector3): boolean {
  return Math.abs(vec3Magnitude(v) - 1) < CANONICAL_EPSILON;
}

/**
 * Returns true if a and b are parallel or anti-parallel.
 * Returns false if either input is near-zero (magnitude ≤ CANONICAL_EPSILON).
 */
export function vec3AreParallel(a: Vector3, b: Vector3): boolean {
  const lenA = vec3Magnitude(a);
  const lenB = vec3Magnitude(b);
  if (lenA <= CANONICAL_EPSILON || lenB <= CANONICAL_EPSILON) return false;
  const unitA: Vector3 = { x: a.x / lenA, y: a.y / lenA, z: a.z / lenA };
  const unitB: Vector3 = { x: b.x / lenB, y: b.y / lenB, z: b.z / lenB };
  return vec3Magnitude(vec3Cross(unitA, unitB)) < CANONICAL_EPSILON;
}

/**
 * Returns the angle in radians between a and b, clamped to [0, π].
 * @throws {RangeError} if either input is near-zero.
 */
export function vec3AngleBetween(a: Vector3, b: Vector3): Radians {
  const ua = vec3Normalize(a); // throws if near-zero
  const ub = vec3Normalize(b); // throws if near-zero
  return Math.acos(Math.min(1, Math.max(-1, vec3Dot(ua, ub))));
}
