/**
 * Kinematic admissibility analysis — Phase 2A.
 *
 * Three pure, deterministic functions:
 *   - evaluatePlanarSliding  (Markland / Hoek & Bray §5)
 *   - evaluateWedgeSliding   (Hoek & Bray §7)
 *   - evaluateDirectToppling (Hoek & Bray direct criterion; flexural deferred)
 *
 * All boundary conditions are strict inequalities (planes on the boundary are
 * NOT admissible).  KINEMATIC_ANGULAR_TOLERANCE guards numerical edge cases at
 * the boundary without introducing an engineering tolerance.
 *
 * Imports only @geokinematics/geometry and @geokinematics/domain.
 * Zero React / browser dependencies.
 */

import type {
  Degrees,
  DirectTopplingResult,
  FrictionAngle,
  KinematicRejectionReason,
  LineOrientation,
  PlaneOrientation,
  PlanarSlidingResult,
  SlopeFace,
  WedgeSlidingResult,
} from '@geokinematics/domain';
import {
  CANONICAL_EPSILON,
  KINEMATIC_ANGULAR_TOLERANCE,
  lineOrientationFromVector,
  normalizeAzimuth,
  normalizePlaneOrientation,
  planeFromPointNormal,
  planeIntersectionLine,
  planeNormalFromOrientation,
  selectDownwardDirection,
} from '@geokinematics/geometry';

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Throws RangeError if any argument is not a finite number. */
function assertFiniteArgs(...pairs: [value: number, label: string][]): void {
  for (const [value, label] of pairs) {
    if (!Number.isFinite(value)) {
      throw new RangeError(`${label} must be finite.`);
    }
  }
}

/**
 * Returns true if the (wrap-safe) azimuth difference is strictly less than
 * `sectorDeg`.  Uses normalizeAzimuth to map the raw difference to [0°, 360°)
 * then tests both the positive and wrap-around sides.
 *
 * Strict: boundary (Δα === sectorDeg) is NOT admissible.
 */
function azimuthWithinSector(alpha1: Degrees, alpha2: Degrees, sectorDeg: Degrees): boolean {
  const delta = normalizeAzimuth(alpha1 - alpha2);
  // delta < sectorDeg  →  positive side
  // delta > 360 - sectorDeg  →  wrap-around side
  return (
    delta < sectorDeg - KINEMATIC_ANGULAR_TOLERANCE ||
    delta > 360 - sectorDeg + KINEMATIC_ANGULAR_TOLERANCE
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Evaluates whether a single discontinuity plane is kinematically admissible
 * for planar sliding on the given slope face (Markland / Hoek & Bray §5).
 *
 * Conditions (all strict inequalities):
 *   1. slope.dip > 0°                      (non-horizontal slope)
 *   2. discontinuity.dip > 0°              (non-horizontal discontinuity)
 *   3. discontinuity.dip < slope.dip       (daylight condition)
 *   4. discontinuity.dip > frictionAngle   (friction condition)
 *   5. |Δα| < azimuthSectorDeg            (dip direction within sector, default ±20°)
 *
 * @param slope           Slope face geometry (no material properties).
 * @param discontinuity   Plane orientation to test.
 * @param frictionAngle   Friction angle in degrees [0°, 90°).
 * @param azimuthSectorDeg  Half-width of the admissible azimuth sector (default 20°).
 * @returns PlanarSlidingResult with admissibility flag, rejection reasons, and margin angles.
 * @throws {RangeError} for non-finite input values.
 */
export function evaluatePlanarSliding(
  slope: SlopeFace,
  discontinuity: PlaneOrientation,
  frictionAngle: FrictionAngle,
  azimuthSectorDeg: number = 20,
): PlanarSlidingResult {
  assertFiniteArgs(
    [slope.dipDirection, 'slope.dipDirection'],
    [slope.dip, 'slope.dip'],
    [discontinuity.dipDirection, 'discontinuity.dipDirection'],
    [discontinuity.dip, 'discontinuity.dip'],
    [frictionAngle, 'frictionAngle'],
    [azimuthSectorDeg, 'azimuthSectorDeg'],
  );

  const s = normalizePlaneOrientation(slope);
  const d = normalizePlaneOrientation(discontinuity);
  const rejections: KinematicRejectionReason[] = [];

  // Degenerate preconditions — checked first; subsequent conditions are meaningless
  if (s.dip <= CANONICAL_EPSILON) {
    rejections.push('horizontalSlope');
  }
  if (d.dip <= CANONICAL_EPSILON) {
    rejections.push('horizontalPlane');
  }

  // If either degenerate, return immediately with those rejections
  if (rejections.length > 0) {
    return {
      mode: 'planarSliding',
      isAdmissible: false,
      rejectionReasons: rejections,
      daylightExcess: s.dip - d.dip,
      frictionExcess: d.dip - frictionAngle,
    };
  }

  const daylightExcess = s.dip - d.dip;
  const frictionExcess = d.dip - frictionAngle;

  // Condition 3: daylight — strict inequality
  if (daylightExcess <= KINEMATIC_ANGULAR_TOLERANCE) {
    rejections.push('daylightConditionFailed');
  }

  // Condition 4: friction — strict inequality
  if (frictionExcess <= KINEMATIC_ANGULAR_TOLERANCE) {
    rejections.push('frictionConditionFailed');
  }

  // Condition 5: azimuth sector — strict inequality
  if (!azimuthWithinSector(d.dipDirection, s.dipDirection, azimuthSectorDeg)) {
    rejections.push('azimuthSectorFailed');
  }

  return {
    mode: 'planarSliding',
    isAdmissible: rejections.length === 0,
    rejectionReasons: rejections,
    daylightExcess,
    frictionExcess,
  };
}

/**
 * Evaluates whether the line of intersection of two discontinuity planes is
 * kinematically admissible for wedge sliding on the given slope face
 * (Hoek & Bray §7).
 *
 * Conditions (all strict inequalities):
 *   1. Planes must not be parallel (otherwise 'noIntersectionLine').
 *   2. slope.dip > 0°
 *   3. intersectionLine.plunge > frictionAngle    (friction condition)
 *   4. intersectionLine.plunge < slope.dip        (daylight condition)
 *   5. |Δα_L − αs| < 90°                          (lateral constraint)
 *   6. n_slope · n1 < 0  AND  n_slope · n2 < 0   (both planes dip into slope)
 *
 * @param slope         Slope face geometry.
 * @param plane1        First discontinuity plane.
 * @param plane2        Second discontinuity plane.
 * @param frictionAngle Friction angle in degrees [0°, 90°), isotropic assumption.
 * @returns WedgeSlidingResult.
 * @throws {RangeError} for non-finite input values.
 */
export function evaluateWedgeSliding(
  slope: SlopeFace,
  plane1: PlaneOrientation,
  plane2: PlaneOrientation,
  frictionAngle: FrictionAngle,
): WedgeSlidingResult {
  assertFiniteArgs(
    [slope.dipDirection, 'slope.dipDirection'],
    [slope.dip, 'slope.dip'],
    [plane1.dipDirection, 'plane1.dipDirection'],
    [plane1.dip, 'plane1.dip'],
    [plane2.dipDirection, 'plane2.dipDirection'],
    [plane2.dip, 'plane2.dip'],
    [frictionAngle, 'frictionAngle'],
  );

  const s = normalizePlaneOrientation(slope);
  const p1 = normalizePlaneOrientation(plane1);
  const p2 = normalizePlaneOrientation(plane2);
  const rejections: KinematicRejectionReason[] = [];

  if (s.dip <= CANONICAL_EPSILON) {
    rejections.push('horizontalSlope');
    return {
      mode: 'wedgeSliding',
      isAdmissible: false,
      rejectionReasons: rejections,
      intersectionLine: null,
      daylightExcess: null,
      frictionExcess: null,
    };
  }

  // Step 1: Compute plane normals (upward-canonical)
  const n1 = planeNormalFromOrientation(p1);
  const n2 = planeNormalFromOrientation(p2);

  // Step 2: Compute intersection line — may throw for parallel planes
  let rawIntersection;
  try {
    const planeObj1 = planeFromPointNormal({ x: 0, y: 0, z: 0 }, n1);
    const planeObj2 = planeFromPointNormal({ x: 0, y: 0, z: 0 }, n2);
    rawIntersection = planeIntersectionLine(planeObj1, planeObj2);
  } catch {
    rejections.push('noIntersectionLine');
    return {
      mode: 'wedgeSliding',
      isAdmissible: false,
      rejectionReasons: rejections,
      intersectionLine: null,
      daylightExcess: null,
      frictionExcess: null,
    };
  }

  // Step 3: Select downward-plunging direction
  const downward = selectDownwardDirection(rawIntersection);

  // Step 4: Derive LineOrientation — lineOrientationFromVector rejects upper hemisphere
  let intersectionLine: LineOrientation;
  try {
    intersectionLine = lineOrientationFromVector(downward);
  } catch {
    // Horizontal intersection (z exactly 0 after selectDownwardDirection) →
    // lineOrientationFromVector would succeed here since z ≤ CANONICAL_EPSILON.
    // selectDownwardDirection guarantees z ≤ CANONICAL_EPSILON, so this path
    // should not trigger. Include defensively.
    rejections.push('daylightConditionFailed');
    return {
      mode: 'wedgeSliding',
      isAdmissible: false,
      rejectionReasons: rejections,
      intersectionLine: null,
      daylightExcess: null,
      frictionExcess: null,
    };
  }

  const { plunge: plungeL, trend: trendL } = intersectionLine;
  const daylightExcess = s.dip - plungeL;
  const frictionExcess = plungeL - frictionAngle;

  // Condition 3: friction — strict
  if (frictionExcess <= KINEMATIC_ANGULAR_TOLERANCE) {
    rejections.push('frictionConditionFailed');
  }

  // Condition 4: daylight — strict
  if (daylightExcess <= KINEMATIC_ANGULAR_TOLERANCE) {
    rejections.push('daylightConditionFailed');
  }

  // Condition 5: lateral constraint — |αL − αs| < 90°, strict
  if (!azimuthWithinSector(trendL, s.dipDirection, 90)) {
    rejections.push('azimuthSectorFailed');
  }

  // Condition 6: both planes must dip toward the slope face.
  // A plane dips "into" the slope when its dip direction is within ±90° of the slope dip
  // direction.  This is equivalent to their dip directions differing by less than 90°
  // (wrap-safe).  Uses the same azimuthWithinSector helper with a 90° half-width.
  const p1DipsIntoSlope = azimuthWithinSector(p1.dipDirection, s.dipDirection, 90);
  const p2DipsIntoSlope = azimuthWithinSector(p2.dipDirection, s.dipDirection, 90);
  if (!p1DipsIntoSlope || !p2DipsIntoSlope) {
    if (!rejections.includes('azimuthSectorFailed')) {
      rejections.push('azimuthSectorFailed');
    }
  }

  return {
    mode: 'wedgeSliding',
    isAdmissible: rejections.length === 0,
    rejectionReasons: rejections,
    intersectionLine,
    daylightExcess,
    frictionExcess,
  };
}

/**
 * Evaluates whether a discontinuity plane is kinematically admissible for
 * DIRECT toppling on the given slope face (Hoek & Bray direct toppling criterion).
 *
 * Flexural toppling is NOT implemented (deferred; requires layer thickness/spacing).
 *
 * Conditions (all strict inequalities):
 *   1. slope.dip > 0°
 *   2. |normalizeAzimuth(αd − (αs + 180°))| < 20°   (dips approximately opposite to slope)
 *   3. discontinuity.dip > (90° − slope.dip) + frictionAngle   (steepness condition)
 *
 * @param slope         Slope face geometry.
 * @param discontinuity Plane orientation to test.
 * @param frictionAngle Friction angle in degrees [0°, 90°).
 * @returns DirectTopplingResult.
 * @throws {RangeError} for non-finite input values.
 */
export function evaluateDirectToppling(
  slope: SlopeFace,
  discontinuity: PlaneOrientation,
  frictionAngle: FrictionAngle,
): DirectTopplingResult {
  assertFiniteArgs(
    [slope.dipDirection, 'slope.dipDirection'],
    [slope.dip, 'slope.dip'],
    [discontinuity.dipDirection, 'discontinuity.dipDirection'],
    [discontinuity.dip, 'discontinuity.dip'],
    [frictionAngle, 'frictionAngle'],
  );

  const s = normalizePlaneOrientation(slope);
  const d = normalizePlaneOrientation(discontinuity);
  const rejections: KinematicRejectionReason[] = [];

  const dipThreshold = 90 - s.dip + frictionAngle;
  const dipExcess = d.dip - dipThreshold;

  if (s.dip <= CANONICAL_EPSILON) {
    rejections.push('horizontalSlope');
    return {
      mode: 'directToppling',
      isAdmissible: false,
      rejectionReasons: rejections,
      dipExcess,
    };
  }

  // Condition 2: anti-parallel dip direction (within ±20°)
  // αd should be approximately (αs + 180°) — the block dips back into the slope
  const antiParallelTarget = normalizeAzimuth(s.dipDirection + 180);
  if (!azimuthWithinSector(d.dipDirection, antiParallelTarget, 20)) {
    rejections.push('azimuthSectorFailed');
  }

  // Condition 3: steepness condition — strict
  if (dipExcess <= KINEMATIC_ANGULAR_TOLERANCE) {
    rejections.push('frictionConditionFailed');
  }

  return {
    mode: 'directToppling',
    isAdmissible: rejections.length === 0,
    rejectionReasons: rejections,
    dipExcess,
  };
}
