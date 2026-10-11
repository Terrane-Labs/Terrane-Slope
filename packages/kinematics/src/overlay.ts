/**
 * Kinematic stereonet overlays — Phase 2A.3.
 *
 * Builds the zones and boundary curves of the planar sliding and direct toppling
 * criteria in pole space on the lower-hemisphere Wulff net (ADR-008), as
 * pre-projected `StereonetPoint` geometry.
 *
 * Classification authority: these overlays are visual aids. Whether a given
 * discontinuity is admissible is decided only by `evaluatePlanarSliding` and
 * `evaluateDirectToppling`. No function here classifies a plane.
 *
 * Pole-space relations (see docs/science/kinematic-zones.md):
 *   - A plane of dip d plots as a pole at Wulff radius r = tan(d / 2).
 *   - A plane of dip direction α plots as a pole of trend α + 180°.
 *   - Circles of constant dip are circles centred on the net centre; constant-trend
 *     lines are straight radial lines.
 *
 * Open-set convention: every boundary produced here is an exclusive limit of the
 * strict inequalities in the evaluators, except the rim of the toppling zone
 * (dip = 90° satisfies the toppling steepness condition).
 *
 * Imports only @geokinematics/geometry and @geokinematics/domain.
 */

import type { Degrees, FrictionAngle, SlopeFace, StereonetPoint } from '@geokinematics/domain';
import {
  normalizeAzimuth,
  projectLine,
  projectLineSectorRings,
  projectSmallCircle,
} from '@geokinematics/geometry';
import { DEFAULT_PLANAR_AZIMUTH_SECTOR_DEG, DIRECT_TOPPLING_AZIMUTH_SECTOR_DEG } from './constants';

/** Maximum angular step (degrees) used when sampling arcs and circles. */
export const OVERLAY_ARC_STEP_DEG: Degrees = 1;

/** Modes for which a pole-space overlay is defined. Wedge sliding is plotted with lines, not poles. */
export type KinematicOverlayMode = 'planarSliding' | 'directToppling';

/**
 * Semantic role of a boundary curve.
 *
 * - `daylightEnvelope`: poles of planes whose dip equals the slope dip (planar sliding).
 * - `frictionCone`: poles of planes whose dip equals the friction angle (planar sliding).
 * - `topplingLimit`: poles of planes whose dip equals 90° − slope dip + friction angle (direct toppling).
 * - `lateralLimit`: radial edge of the admissible dip-direction sector.
 */
export type KinematicOverlayRole =
  'daylightEnvelope' | 'frictionCone' | 'topplingLimit' | 'lateralLimit';

/** An ordered polyline in stereonet coordinates. */
export interface KinematicOverlayCurve {
  readonly role: KinematicOverlayRole;
  readonly points: readonly StereonetPoint[];
}

/**
 * Admissible region as closed rings (no repeated closing point), for even-odd filling.
 * Empty `rings` means that no discontinuity orientation can satisfy the criterion
 * for the given parameters.
 */
export interface KinematicOverlayZone {
  readonly rings: readonly (readonly StereonetPoint[])[];
}

export interface KinematicOverlay {
  readonly mode: KinematicOverlayMode;
  readonly zone: KinematicOverlayZone;
  readonly curves: readonly KinematicOverlayCurve[];
}

function assertOverlayInputs(
  slope: SlopeFace,
  frictionAngle: FrictionAngle,
  azimuthSectorDeg: Degrees,
): void {
  const checks: [value: number, label: string][] = [
    [slope.dipDirection, 'slope.dipDirection'],
    [slope.dip, 'slope.dip'],
    [frictionAngle, 'frictionAngle'],
    [azimuthSectorDeg, 'azimuthSectorDeg'],
  ];
  for (const [value, label] of checks) {
    if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite.`);
  }
  if (slope.dip < 0 || slope.dip > 90) {
    throw new RangeError('slope.dip must be within [0°, 90°].');
  }
  if (frictionAngle < 0 || frictionAngle >= 90) {
    throw new RangeError('frictionAngle must be within [0°, 90°).');
  }
  if (azimuthSectorDeg <= 0 || azimuthSectorDeg > 180) {
    throw new RangeError('azimuthSectorDeg must be within (0°, 180°].');
  }
}

/** Closed circle of constant pole plunge, or no curve when the circle degenerates to the centre. */
function plungeCircle(
  role: KinematicOverlayRole,
  plunge: Degrees,
): readonly KinematicOverlayCurve[] {
  if (plunge >= 90) return [];
  const segments = Math.ceil(360 / OVERLAY_ARC_STEP_DEG);
  return [{ role, points: projectSmallCircle(plunge, segments) }];
}

/** The two radial edges of a trend sector between two pole plunges. Empty for full-annulus sectors. */
function lateralLimits(
  centerTrend: Degrees,
  halfWidth: Degrees,
  outerPlunge: Degrees,
  innerPlunge: Degrees,
): readonly KinematicOverlayCurve[] {
  if (halfWidth >= 180) return [];
  return [-halfWidth, halfWidth].map((offset) => ({
    role: 'lateralLimit' as const,
    points: [
      projectLine({ trend: normalizeAzimuth(centerTrend + offset), plunge: innerPlunge }),
      projectLine({ trend: normalizeAzimuth(centerTrend + offset), plunge: outerPlunge }),
    ],
  }));
}

/**
 * Pole-space overlay for the planar sliding criterion (Markland / Hoek & Bray §5).
 *
 * Admissible poles satisfy, in angle space:
 *   φ < dip < ψf   and   |α_d − α_s| < sector
 * which in pole space is the annular sector
 *   tan(φ/2) < r < tan(ψf/2),  pole trend within ±sector of α_s + 180°.
 * The zone is empty when ψf ≤ φ.
 *
 * @param slope            Slope face geometry.
 * @param frictionAngle    Friction angle in degrees, [0°, 90°).
 * @param azimuthSectorDeg Half-width of the dip-direction sector, (0°, 180°]. Defaults to the
 *                         evaluator default.
 * @throws {RangeError} for non-finite values or values outside the ranges above.
 */
export function buildPlanarSlidingOverlay(
  slope: SlopeFace,
  frictionAngle: FrictionAngle,
  azimuthSectorDeg: Degrees = DEFAULT_PLANAR_AZIMUTH_SECTOR_DEG,
): KinematicOverlay {
  assertOverlayInputs(slope, frictionAngle, azimuthSectorDeg);

  const slopeDip = slope.dip;
  const poleTrend = normalizeAzimuth(slope.dipDirection + 180);
  const outerPlunge = 90 - slopeDip; // dip = ψf  → daylight envelope
  const innerPlunge = 90 - frictionAngle; // dip = φ → friction cone

  const rings = projectLineSectorRings(
    outerPlunge,
    innerPlunge,
    poleTrend,
    azimuthSectorDeg,
    OVERLAY_ARC_STEP_DEG,
  );

  const curves: KinematicOverlayCurve[] = [
    ...plungeCircle('daylightEnvelope', outerPlunge),
    ...plungeCircle('frictionCone', innerPlunge),
  ];
  if (rings.length > 0) {
    curves.push(...lateralLimits(poleTrend, azimuthSectorDeg, outerPlunge, innerPlunge));
  }

  return { mode: 'planarSliding', zone: { rings }, curves };
}

/**
 * Pole-space overlay for the direct toppling criterion (Goodman & Bray, as
 * implemented by `evaluateDirectToppling`).
 *
 * Admissible poles satisfy, in angle space:
 *   dip > 90° − ψf + φ   and   |α_d − (α_s + 180°)| < sector
 * which in pole space is the region outside the circle r = tan((90° − ψf + φ)/2)
 * up to the rim, with pole trend within ±sector of α_s. The zone is empty when ψf ≤ φ.
 *
 * @param slope         Slope face geometry.
 * @param frictionAngle Friction angle in degrees, [0°, 90°).
 * @throws {RangeError} for non-finite values or values outside the ranges above.
 */
export function buildDirectTopplingOverlay(
  slope: SlopeFace,
  frictionAngle: FrictionAngle,
): KinematicOverlay {
  assertOverlayInputs(slope, frictionAngle, DIRECT_TOPPLING_AZIMUTH_SECTOR_DEG);

  const poleTrend = normalizeAzimuth(slope.dipDirection);
  // dip > 90° − ψf + φ  ⇔  pole plunge < ψf − φ.
  const limitPlunge = slope.dip - frictionAngle;

  const rings =
    limitPlunge > 0
      ? projectLineSectorRings(
          0,
          limitPlunge,
          poleTrend,
          DIRECT_TOPPLING_AZIMUTH_SECTOR_DEG,
          OVERLAY_ARC_STEP_DEG,
        )
      : [];

  const curves: KinematicOverlayCurve[] = [];
  if (rings.length > 0) {
    curves.push(...plungeCircle('topplingLimit', limitPlunge));
    curves.push(...lateralLimits(poleTrend, DIRECT_TOPPLING_AZIMUTH_SECTOR_DEG, 0, limitPlunge));
  }

  return { mode: 'directToppling', zone: { rings }, curves };
}

/**
 * Builds the pole-space overlay for the requested mode.
 *
 * @throws {RangeError} per the mode-specific builders.
 */
export function buildKinematicOverlay(
  mode: KinematicOverlayMode,
  slope: SlopeFace,
  frictionAngle: FrictionAngle,
): KinematicOverlay {
  return mode === 'planarSliding'
    ? buildPlanarSlidingOverlay(slope, frictionAngle)
    : buildDirectTopplingOverlay(slope, frictionAngle);
}
