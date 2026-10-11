import type {
  Degrees,
  LineOrientation,
  PlaneOrientation,
  StereonetPoint,
  Vector3,
} from '@terrane-labs/domain';
import { degreesToRadians, normalizeAzimuth, radiansToDegrees } from './angle';
import { CANONICAL_EPSILON } from './tolerance';
import { vec3Add, vec3Scale, vec3Normalize, vec3Negate } from './vector';
import {
  normalizePlaneOrientation,
  planeStrikeVector,
  planeDownDipVector,
  planeNormalFromOrientation,
} from './plane';

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

/**
 * Validates and canonicalizes a geological line orientation.
 * Ensures plunge is in [0°, 90°] and normalizes trend to [0°, 360°).
 */
export function normalizeLineOrientation(orientation: LineOrientation): LineOrientation {
  assertFinite(orientation.plunge, 'Plunge');
  if (orientation.plunge < 0 || orientation.plunge > 90) {
    throw new RangeError('Plunge must be within [0°, 90°].');
  }
  return {
    trend: normalizeAzimuth(orientation.trend),
    plunge: orientation.plunge,
  };
}

/**
 * Converts a geological line orientation to a unit Cartesian vector in the ENU basis.
 */
export function lineVectorFromOrientation(orientation: LineOrientation): Vector3 {
  const { trend, plunge } = normalizeLineOrientation(orientation);
  const trendRad = degreesToRadians(trend);
  const plungeRad = degreesToRadians(plunge);
  return {
    x: Math.sin(trendRad) * Math.cos(plungeRad),
    y: Math.cos(trendRad) * Math.cos(plungeRad),
    z: -Math.sin(plungeRad),
  };
}

/**
 * Converts a unit Cartesian vector to a geological line orientation.
 *
 * @throws {RangeError} if the vector is near-zero or explicitly in the upper hemisphere.
 */
export function lineOrientationFromVector(vector: Vector3): LineOrientation {
  const v = vec3Normalize(vector);
  if (v.z > CANONICAL_EPSILON) {
    throw new RangeError('Vector represents an upper-hemisphere line.');
  }
  const clampedZ = Math.min(0, Math.max(-1, v.z));
  const plungeRaw = radiansToDegrees(Math.asin(-clampedZ));
  const plunge = plungeRaw === 0 ? 0 : plungeRaw;
  const trend = normalizeAzimuth(radiansToDegrees(Math.atan2(v.x, v.y)));
  return { trend, plunge };
}

/**
 * Returns the unit vector in the downward-plunging direction of a line.
 *
 * If the vector has an upward vertical component (z > CANONICAL_EPSILON), it is negated.
 * For horizontal lines (|z| <= CANONICAL_EPSILON), deterministic tie-breaking is applied:
 * prefer x > 0; when x is approximately zero prefer y >= 0.
 *
 * @throws {RangeError} if the vector is near-zero (magnitude <= CANONICAL_EPSILON).
 */
export function selectDownwardDirection(vector: Vector3): Vector3 {
  const normalized = vec3Normalize(vector); // throws for near-zero
  const isUpwardOrNegativeTieBreak =
    normalized.z > CANONICAL_EPSILON ||
    (Math.abs(normalized.z) <= CANONICAL_EPSILON && normalized.x < -CANONICAL_EPSILON) ||
    (Math.abs(normalized.z) <= CANONICAL_EPSILON &&
      Math.abs(normalized.x) <= CANONICAL_EPSILON &&
      normalized.y < 0);
  return zeroSmallComponents(isUpwardOrNegativeTieBreak ? vec3Negate(normalized) : normalized);
}

/**
 * Projects a geological line onto a lower-hemisphere equal-angle stereonet (Wulff net).
 */
export function projectLine(orientation: LineOrientation): StereonetPoint {
  const { trend, plunge } = normalizeLineOrientation(orientation);
  const trendRad = degreesToRadians(trend);
  const plungeRad = degreesToRadians(plunge);

  const r = Math.tan(Math.PI / 4 - plungeRad / 2);

  return {
    x: r * Math.sin(trendRad),
    y: r * Math.cos(trendRad),
  };
}

/**
 * Unprojects a Wulff net stereonet point back into a geological line orientation.
 *
 * @throws {RangeError} if the point lies outside the unit disk beyond tolerance.
 */
export function unprojectLine(point: StereonetPoint): LineOrientation {
  assertFinite(point.x, 'Point X');
  assertFinite(point.y, 'Point Y');

  const r = Math.hypot(point.x, point.y);
  if (r > 1 + CANONICAL_EPSILON) {
    throw new RangeError('Point lies outside the projection disk.');
  }

  if (r <= CANONICAL_EPSILON) {
    return { trend: 0, plunge: 90 };
  }

  const clampedR = Math.min(1, r);
  const plunge = 90 - 2 * radiansToDegrees(Math.atan(clampedR));
  const trend = normalizeAzimuth(radiansToDegrees(Math.atan2(point.x, point.y)));

  return { trend, plunge };
}

/**
 * Projects the pole (normal) of a plane onto the Wulff net.
 */
export function projectPlanePole(orientation: PlaneOrientation): StereonetPoint {
  // Phase 1A ensures the normal is canonicalized to face upward.
  // The pole on a lower-hemisphere stereonet uses the downward-facing equivalent.
  const normal = planeNormalFromOrientation(orientation);
  const downwardNormal = { x: -normal.x, y: -normal.y, z: -normal.z };
  return projectLine(lineOrientationFromVector(downwardNormal));
}

/**
 * Generates points tracing the great-circle projection of a plane on a Wulff net.
 */
export function projectPlaneGreatCircle(
  orientation: PlaneOrientation,
  segments: number = 180,
): readonly StereonetPoint[] {
  if (!Number.isInteger(segments) || segments < 1) {
    throw new RangeError('Segments must be a positive integer.');
  }

  const { dip } = normalizePlaneOrientation(orientation);
  const isHorizontal = Math.abs(dip) <= CANONICAL_EPSILON;

  const S = planeStrikeVector(orientation);
  const D = planeDownDipVector(orientation);

  const points: StereonetPoint[] = [];
  const limit = isHorizontal ? 2 * Math.PI : Math.PI;

  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * limit;
    const v = vec3Add(vec3Scale(S, Math.cos(theta)), vec3Scale(D, Math.sin(theta)));
    points.push(projectLine(lineOrientationFromVector(v)));
  }

  return points;
}

/**
 * Generates points tracing the small-circle projection of a constant plunge on a Wulff net.
 *
 * @param plunge Geological plunge in decimal degrees [0°, 90°].
 * @param segments Number of angular subdivisions (default 180). Must be a positive integer.
 * @returns An ordered array of pre-projected `StereonetPoint` coordinates forming a closed loop.
 * @throws {RangeError} if plunge is not in [0°, 90°] or segments is not a positive integer.
 */
export function projectSmallCircle(
  plunge: Degrees,
  segments: number = 180,
): readonly StereonetPoint[] {
  assertFinite(plunge, 'Plunge');
  if (plunge < 0 || plunge > 90) {
    throw new RangeError('Plunge must be within [0°, 90°].');
  }
  if (!Number.isInteger(segments) || segments < 1) {
    throw new RangeError('Segments must be a positive integer.');
  }

  const points: StereonetPoint[] = [];
  for (let i = 0; i <= segments; i++) {
    const trend = (i / segments) * 360;
    points.push(projectLine({ trend, plunge }));
  }

  return points;
}

/**
 * Generates points tracing an arc of the small-circle projection of a constant plunge.
 *
 * The arc runs clockwise (increasing trend) from `startTrend` to `endTrend`.
 * Trends are interpreted as continuous values, so an arc may cross 0°/360°
 * (for example `startTrend = 350`, `endTrend = 370`).
 *
 * @param plunge     Constant plunge in decimal degrees [0°, 90°].
 * @param startTrend Trend of the first point, any finite value.
 * @param endTrend   Trend of the last point. `endTrend - startTrend` must lie in [0°, 360°].
 * @param segments   Number of angular subdivisions. Must be a positive integer.
 * @returns `segments + 1` points. The first and last point coincide when the sweep is 360°.
 * @throws {RangeError} for non-finite values, plunge outside [0°, 90°], a sweep outside
 *   [0°, 360°], or a non-positive-integer `segments`.
 */
export function projectSmallCircleArc(
  plunge: Degrees,
  startTrend: Degrees,
  endTrend: Degrees,
  segments: number,
): readonly StereonetPoint[] {
  assertFinite(plunge, 'Plunge');
  assertFinite(startTrend, 'Start trend');
  assertFinite(endTrend, 'End trend');
  if (plunge < 0 || plunge > 90) {
    throw new RangeError('Plunge must be within [0°, 90°].');
  }
  const sweep = endTrend - startTrend;
  if (sweep < 0 || sweep > 360) {
    throw new RangeError('Arc sweep must be within [0°, 360°].');
  }
  if (!Number.isInteger(segments) || segments < 1) {
    throw new RangeError('Segments must be a positive integer.');
  }

  const points: StereonetPoint[] = [];
  for (let i = 0; i <= segments; i++) {
    const trend = startTrend + (sweep * i) / segments;
    points.push(projectLine({ trend, plunge }));
  }
  return points;
}

/**
 * Builds the closed outline(s) of the region of line orientations whose plunge lies
 * between `minPlunge` and `maxPlunge` and whose trend lies within
 * `±halfWidth` of `centerTrend`, projected on the Wulff net.
 *
 * Constant-trend edges are straight radial segments on the equal-angle net; constant-plunge
 * edges are small-circle arcs sampled with `arcStepDeg` resolution. Rings are returned
 * without a repeated closing point and are intended for even-odd filling:
 *
 * - `minPlunge >= maxPlunge`: empty region, returns `[]`.
 * - `halfWidth >= 180`: full annulus — an outer ring, plus an inner ring unless
 *   `maxPlunge === 90` (the inner boundary collapses to the net centre).
 * - otherwise: one ring (outer arc, then inner arc in reverse). When `maxPlunge === 90`
 *   the inner arc collapses to the net centre and contributes a single vertex.
 *
 * Whether a boundary belongs to the region is the caller's decision; this function
 * produces geometry only.
 *
 * @param minPlunge   Smaller plunge bound (outer edge, nearer the rim) in [0°, 90°].
 * @param maxPlunge   Larger plunge bound (inner edge, nearer the centre) in [0°, 90°].
 * @param centerTrend Trend at the middle of the sector, any finite value.
 * @param halfWidth   Sector half-width in degrees, in (0°, 360°].
 * @param arcStepDeg  Maximum angular step along arcs, in (0°, 90°]. Default 1°.
 * @throws {RangeError} for non-finite values or arguments outside the stated ranges.
 */
export function projectLineSectorRings(
  minPlunge: Degrees,
  maxPlunge: Degrees,
  centerTrend: Degrees,
  halfWidth: Degrees,
  arcStepDeg: Degrees = 1,
): readonly (readonly StereonetPoint[])[] {
  assertFinite(minPlunge, 'Minimum plunge');
  assertFinite(maxPlunge, 'Maximum plunge');
  assertFinite(centerTrend, 'Center trend');
  assertFinite(halfWidth, 'Half-width');
  assertFinite(arcStepDeg, 'Arc step');
  if (minPlunge < 0 || minPlunge > 90 || maxPlunge < 0 || maxPlunge > 90) {
    throw new RangeError('Plunge bounds must be within [0°, 90°].');
  }
  if (halfWidth <= 0 || halfWidth > 360) {
    throw new RangeError('Half-width must be within (0°, 360°].');
  }
  if (arcStepDeg <= 0 || arcStepDeg > 90) {
    throw new RangeError('Arc step must be within (0°, 90°].');
  }
  if (minPlunge >= maxPlunge) return [];

  const innerCollapsed = maxPlunge === 90;

  if (halfWidth >= 180) {
    const segments = Math.ceil(360 / arcStepDeg);
    const outer = projectSmallCircleArc(minPlunge, 0, 360, segments).slice(0, -1);
    if (innerCollapsed) return [outer];
    const inner = projectSmallCircleArc(maxPlunge, 0, 360, segments).slice(0, -1);
    return [outer, inner];
  }

  const start = centerTrend - halfWidth;
  const end = centerTrend + halfWidth;
  const segments = Math.max(1, Math.ceil((2 * halfWidth) / arcStepDeg));
  const outerArc = projectSmallCircleArc(minPlunge, start, end, segments);
  const ring: StereonetPoint[] = [...outerArc];
  if (innerCollapsed) {
    ring.push(projectLine({ trend: centerTrend, plunge: 90 }));
  } else {
    ring.push(...projectSmallCircleArc(maxPlunge, start, end, segments).slice().reverse());
  }
  return [ring];
}
