/**
 * Framework-independent coordinate and orientation vocabulary.
 *
 * These aliases intentionally remain plain numbers in Phase 1A. Their units
 * are part of the public contract and are validated by package functions.
 */
export type Degrees = number;
export type Radians = number;
export type Metres = number;

/** A minimal Cartesian tuple used for positions, directions, and normals. */
export interface Vector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * The orientation of a plane, expressed as its downward dip direction and
 * dip angle. Both values are decimal degrees.
 */
export interface PlaneOrientation {
  readonly dipDirection: Degrees;
  readonly dip: Degrees;
}

/**
 * The orientation of a geological line, expressed as its downward plunge
 * and clockwise trend from North. Both values are decimal degrees.
 */
export interface LineOrientation {
  readonly trend: Degrees;
  readonly plunge: Degrees;
}

/**
 * A projected point on a stereonet, typically representing a unit-radius disk.
 */
export interface StereonetPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * The orientation of a slope face, expressed as its downward dip direction and
 * dip angle. Both values are decimal degrees.
 */
export interface SlopeFace {
  readonly dipDirection: Degrees;
  readonly dip: Degrees;
}

/**
 * A friction angle in decimal degrees.
 */
export type FrictionAngle = Degrees;

// ── Kinematic analysis types (Phase 2A) ─────────────────────────────────────

/**
 * Discriminant identifying which kinematic analysis mode produced a result.
 */
export type KinematicMode = 'planarSliding' | 'wedgeSliding' | 'directToppling';

/**
 * Reasons why a discontinuity (or pair of discontinuities) is not kinematically
 * admissible. An admissible result carries an empty array.
 */
export type KinematicRejectionReason =
  /** Planes are parallel — no intersection line exists (wedge only). */
  | 'noIntersectionLine'
  /** Daylight condition failed: plane/line dip ≥ slope dip. */
  | 'daylightConditionFailed'
  /** Friction condition failed: plane/line dip ≤ friction angle. */
  | 'frictionConditionFailed'
  /** Outside the admissible azimuth sector, or planes dip away from slope. */
  | 'azimuthSectorFailed'
  /** Input discontinuity is horizontal (dip = 0°). */
  | 'horizontalPlane'
  /** Slope face is horizontal (dip = 0°). */
  | 'horizontalSlope';

/**
 * Base type for all kinematic admissibility results.
 * Invariant: `isAdmissible === (rejectionReasons.length === 0)`.
 */
export interface KinematicResultBase {
  readonly mode: KinematicMode;
  readonly isAdmissible: boolean;
  readonly rejectionReasons: readonly KinematicRejectionReason[];
}

/**
 * Result of a planar sliding kinematic admissibility check.
 *
 * `daylightExcess`: slope.dip − discontinuity.dip (positive = daylight satisfied).
 * `frictionExcess`: discontinuity.dip − frictionAngle (positive = friction satisfied).
 *
 * These are angular quantities in degrees, not safety factors.
 */
export interface PlanarSlidingResult extends KinematicResultBase {
  readonly mode: 'planarSliding';
  readonly daylightExcess: Degrees;
  readonly frictionExcess: Degrees;
}

/**
 * Result of a wedge sliding kinematic admissibility check.
 *
 * `intersectionLine`: the plunging line of intersection (null if planes are parallel).
 * `daylightExcess` / `frictionExcess`: null if the intersection line could not be computed.
 */
export interface WedgeSlidingResult extends KinematicResultBase {
  readonly mode: 'wedgeSliding';
  readonly intersectionLine: LineOrientation | null;
  readonly daylightExcess: Degrees | null;
  readonly frictionExcess: Degrees | null;
}

/**
 * Result of a direct toppling kinematic admissibility check.
 *
 * `dipExcess`: discontinuity.dip − (90° − slope.dip + frictionAngle);
 *              positive = dip condition satisfied.
 */
export interface DirectTopplingResult extends KinematicResultBase {
  readonly mode: 'directToppling';
  readonly dipExcess: Degrees;
}
