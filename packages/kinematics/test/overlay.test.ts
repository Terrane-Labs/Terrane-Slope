import { describe, expect, it } from 'vitest';
import type { PlaneOrientation, SlopeFace, StereonetPoint } from '@terrane-labs/domain';
import { normalizeAzimuth, projectPlanePole } from '@terrane-labs/geometry';
import {
  DEFAULT_PLANAR_AZIMUTH_SECTOR_DEG,
  DIRECT_TOPPLING_AZIMUTH_SECTOR_DEG,
  buildDirectTopplingOverlay,
  buildKinematicOverlay,
  buildPlanarSlidingOverlay,
  evaluateDirectToppling,
  evaluatePlanarSliding,
  type KinematicOverlay,
} from '../src';

const DEG = Math.PI / 180;
const radius = (p: StereonetPoint): number => Math.hypot(p.x, p.y);
const trendOf = (p: StereonetPoint): number => normalizeAzimuth(Math.atan2(p.x, p.y) / DEG);
/** Smallest absolute difference between two azimuths, in [0°, 180°]. */
const azimuthDelta = (a: number, b: number): number => {
  const d = normalizeAzimuth(a - b);
  return d > 180 ? 360 - d : d;
};

/** Even-odd point-in-region test over all rings. */
function inRegion(point: StereonetPoint, rings: readonly (readonly StereonetPoint[])[]): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i]!;
      const b = ring[j]!;
      if (
        a.y > point.y !== b.y > point.y &&
        point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
      ) {
        inside = !inside;
      }
    }
  }
  return inside;
}

describe('overlay parameter validation', () => {
  const slope: SlopeFace = { dipDirection: 130, dip: 60 };

  it('throws RangeError for non-finite inputs', () => {
    expect(() => buildPlanarSlidingOverlay({ dipDirection: NaN, dip: 60 }, 30)).toThrow(RangeError);
    expect(() => buildPlanarSlidingOverlay({ dipDirection: 130, dip: Infinity }, 30)).toThrow(
      RangeError,
    );
    expect(() => buildPlanarSlidingOverlay(slope, NaN)).toThrow(RangeError);
    expect(() => buildDirectTopplingOverlay(slope, NaN)).toThrow(RangeError);
  });

  it('throws RangeError for friction outside [0°, 90°)', () => {
    expect(() => buildPlanarSlidingOverlay(slope, -1)).toThrow(RangeError);
    expect(() => buildPlanarSlidingOverlay(slope, 90)).toThrow(RangeError);
    expect(() => buildDirectTopplingOverlay(slope, 90)).toThrow(RangeError);
  });

  it('throws RangeError for slope dip outside [0°, 90°]', () => {
    expect(() => buildPlanarSlidingOverlay({ dipDirection: 0, dip: -1 }, 30)).toThrow(RangeError);
    expect(() => buildPlanarSlidingOverlay({ dipDirection: 0, dip: 91 }, 30)).toThrow(RangeError);
  });

  it('throws RangeError for sector outside (0°, 180°]', () => {
    expect(() => buildPlanarSlidingOverlay(slope, 30, 0)).toThrow(RangeError);
    expect(() => buildPlanarSlidingOverlay(slope, 30, 181)).toThrow(RangeError);
  });
});

describe('planar sliding overlay geometry', () => {
  const slope: SlopeFace = { dipDirection: 130, dip: 60 };
  const phi = 30;
  const overlay = buildPlanarSlidingOverlay(slope, phi);

  it('has one ring whose vertices lie on r = tan(dip/2) for dip = ψf and dip = φ', () => {
    expect(overlay.mode).toBe('planarSliding');
    expect(overlay.zone.rings).toHaveLength(1);
    const rOuter = Math.tan((slope.dip * DEG) / 2);
    const rInner = Math.tan((phi * DEG) / 2);
    for (const p of overlay.zone.rings[0]!) {
      const r = radius(p);
      expect(Math.abs(r - rOuter) < 1e-12 || Math.abs(r - rInner) < 1e-12).toBe(true);
    }
  });

  it('centres the sector on pole trend α_s + 180° and honours the sector half-width', () => {
    const centre = normalizeAzimuth(slope.dipDirection + 180);
    for (const p of overlay.zone.rings[0]!) {
      expect(azimuthDelta(trendOf(p), centre)).toBeLessThanOrEqual(
        DEFAULT_PLANAR_AZIMUTH_SECTOR_DEG + 1e-9,
      );
    }
  });

  it('emits daylight envelope, friction cone, and two lateral limits', () => {
    const roles = overlay.curves.map((c) => c.role).sort();
    expect(roles).toEqual(['daylightEnvelope', 'frictionCone', 'lateralLimit', 'lateralLimit']);
    const daylight = overlay.curves.find((c) => c.role === 'daylightEnvelope')!;
    for (const p of daylight.points) {
      expect(radius(p)).toBeCloseTo(Math.tan((slope.dip * DEG) / 2), 12);
    }
    const friction = overlay.curves.find((c) => c.role === 'frictionCone')!;
    for (const p of friction.points) {
      expect(radius(p)).toBeCloseTo(Math.tan((phi * DEG) / 2), 12);
    }
  });

  it('returns an empty zone when ψf ≤ φ, including equality', () => {
    expect(buildPlanarSlidingOverlay({ dipDirection: 0, dip: 30 }, 30).zone.rings).toEqual([]);
    expect(buildPlanarSlidingOverlay({ dipDirection: 0, dip: 20 }, 30).zone.rings).toEqual([]);
  });

  it('returns an empty zone and no friction cone for a horizontal slope with φ = 0', () => {
    const o = buildPlanarSlidingOverlay({ dipDirection: 0, dip: 0 }, 0);
    expect(o.zone.rings).toEqual([]);
    expect(o.curves).toEqual([]);
  });

  it('φ = 0 gives a sector that reaches the net centre and has no friction cone curve', () => {
    const o = buildPlanarSlidingOverlay(slope, 0);
    expect(o.zone.rings).toHaveLength(1);
    expect(o.curves.some((c) => c.role === 'frictionCone')).toBe(false);
    const last = o.zone.rings[0]![o.zone.rings[0]!.length - 1]!;
    expect(radius(last)).toBeCloseTo(0, 12);
  });

  it('sector = 180° gives a full annulus with no lateral limits', () => {
    const o = buildPlanarSlidingOverlay(slope, phi, 180);
    expect(o.zone.rings).toHaveLength(2);
    expect(o.curves.some((c) => c.role === 'lateralLimit')).toBe(false);
  });

  it('is deterministic', () => {
    expect(buildPlanarSlidingOverlay(slope, phi)).toEqual(buildPlanarSlidingOverlay(slope, phi));
  });

  it('handles a slope dip direction that wraps the pole trend through 0°/360°', () => {
    const o = buildPlanarSlidingOverlay({ dipDirection: 175, dip: 60 }, 30);
    expect(o.zone.rings).toHaveLength(1);
    for (const p of o.zone.rings[0]!) {
      expect(azimuthDelta(trendOf(p), 355)).toBeLessThanOrEqual(20 + 1e-9);
    }
  });
});

describe('direct toppling overlay geometry', () => {
  const slope: SlopeFace = { dipDirection: 130, dip: 60 };
  const phi = 30;
  const overlay = buildDirectTopplingOverlay(slope, phi);

  it('centres the sector on pole trend α_s (not α_s + 180°)', () => {
    expect(overlay.mode).toBe('directToppling');
    for (const p of overlay.zone.rings[0]!) {
      if (radius(p) > 1e-9) {
        expect(azimuthDelta(trendOf(p), slope.dipDirection)).toBeLessThanOrEqual(
          DIRECT_TOPPLING_AZIMUTH_SECTOR_DEG + 1e-9,
        );
      }
    }
  });

  it('inner boundary lies at r = tan((90° − ψf + φ)/2) and outer edge on the rim', () => {
    const rInner = Math.tan(((90 - slope.dip + phi) * DEG) / 2);
    for (const p of overlay.zone.rings[0]!) {
      const r = radius(p);
      expect(Math.abs(r - rInner) < 1e-12 || Math.abs(r - 1) < 1e-12).toBe(true);
    }
    const limit = overlay.curves.find((c) => c.role === 'topplingLimit')!;
    for (const p of limit.points) expect(radius(p)).toBeCloseTo(rInner, 12);
  });

  it('returns an empty zone and no curves when ψf ≤ φ', () => {
    const o = buildDirectTopplingOverlay({ dipDirection: 0, dip: 30 }, 30);
    expect(o.zone.rings).toEqual([]);
    expect(o.curves).toEqual([]);
  });

  it('φ = 0 and ψf = 90° still yields a zone', () => {
    expect(buildDirectTopplingOverlay({ dipDirection: 0, dip: 90 }, 0).zone.rings).toHaveLength(1);
  });
});

describe('buildKinematicOverlay dispatch', () => {
  it('routes by mode', () => {
    const slope: SlopeFace = { dipDirection: 90, dip: 55 };
    expect(buildKinematicOverlay('planarSliding', slope, 25).mode).toBe('planarSliding');
    expect(buildKinematicOverlay('directToppling', slope, 25).mode).toBe('directToppling');
  });
});

// ── Overlay ↔ evaluator consistency ───────────────────────────────────────────
// Sweeps a dip-direction × dip grid. For every plane that is farther than
// `MARGIN` degrees (in angle space) from every boundary, the pole's membership in
// the drawn zone must equal the evaluator verdict. Planes within the margin are
// skipped: the overlay is a polyline approximation and classification belongs to
// the evaluators.

const MARGIN = 0.75;

interface SweepCase {
  readonly name: string;
  readonly slope: SlopeFace;
  readonly phi: number;
}

const SWEEP_CASES: readonly SweepCase[] = [
  { name: 'typical', slope: { dipDirection: 130, dip: 60 }, phi: 30 },
  { name: 'west-facing', slope: { dipDirection: 270, dip: 45 }, phi: 20 },
  { name: 'zero friction', slope: { dipDirection: 0, dip: 75 }, phi: 0 },
  { name: 'wraps through north', slope: { dipDirection: 355, dip: 60 }, phi: 30 },
  { name: 'wraps through south', slope: { dipDirection: 178, dip: 55 }, phi: 25 },
  { name: 'vertical face', slope: { dipDirection: 45, dip: 90 }, phi: 10 },
  { name: 'empty zone (ψf < φ)', slope: { dipDirection: 200, dip: 30 }, phi: 35 },
];

function sweep(
  overlay: KinematicOverlay,
  evaluate: (plane: PlaneOrientation) => boolean,
  isNearBoundary: (plane: PlaneOrientation) => boolean,
): { admissible: number; rejected: number } {
  let admissible = 0;
  let rejected = 0;
  for (let dd = 1.3; dd < 360; dd += 3) {
    for (let dip = 0.7; dip < 90; dip += 2.5) {
      const plane: PlaneOrientation = { dipDirection: dd, dip };
      if (isNearBoundary(plane)) continue;
      const verdict = evaluate(plane);
      const drawn = inRegion(projectPlanePole(plane), overlay.zone.rings);
      expect(
        drawn,
        `${overlay.mode} dd=${dd.toFixed(1)} dip=${dip.toFixed(1)}: zone=${drawn} evaluator=${verdict}`,
      ).toBe(verdict);
      if (verdict) admissible++;
      else rejected++;
    }
  }
  return { admissible, rejected };
}

describe('overlay ↔ evaluator consistency', () => {
  for (const { name, slope, phi } of SWEEP_CASES) {
    it(`planar sliding agrees with evaluatePlanarSliding — ${name}`, () => {
      const overlay = buildPlanarSlidingOverlay(slope, phi);
      const { admissible, rejected } = sweep(
        overlay,
        (plane) => evaluatePlanarSliding(slope, plane, phi).isAdmissible,
        (plane) =>
          Math.abs(plane.dip - slope.dip) < MARGIN ||
          Math.abs(plane.dip - phi) < MARGIN ||
          Math.abs(azimuthDelta(plane.dipDirection, slope.dipDirection) - 20) < MARGIN,
      );
      expect(rejected).toBeGreaterThan(0);
      if (slope.dip > phi) expect(admissible).toBeGreaterThan(0);
      else expect(admissible).toBe(0);
    });

    it(`direct toppling agrees with evaluateDirectToppling — ${name}`, () => {
      const overlay = buildDirectTopplingOverlay(slope, phi);
      const threshold = 90 - slope.dip + phi;
      const { admissible, rejected } = sweep(
        overlay,
        (plane) => evaluateDirectToppling(slope, plane, phi).isAdmissible,
        (plane) =>
          Math.abs(plane.dip - threshold) < MARGIN ||
          plane.dip > 90 - MARGIN ||
          Math.abs(azimuthDelta(plane.dipDirection, slope.dipDirection + 180) - 20) < MARGIN,
      );
      expect(rejected).toBeGreaterThan(0);
      if (slope.dip > phi) expect(admissible).toBeGreaterThan(0);
      else expect(admissible).toBe(0);
    });
  }
});
