import { describe, expect, test } from 'vitest';
import type { StereonetPoint } from '@terrane-labs/domain';
import { projectLine, projectLineSectorRings, projectSmallCircleArc } from '../src/stereonet';

const radius = (p: StereonetPoint): number => Math.hypot(p.x, p.y);
/** Trend of a stereonet point in degrees clockwise from North, [0, 360). */
const trendOf = (p: StereonetPoint): number => {
  const t = (Math.atan2(p.x, p.y) * 180) / Math.PI;
  return ((t % 360) + 360) % 360;
};

describe('projectSmallCircleArc', () => {
  test('returns segments + 1 points on the expected radius', () => {
    const plunge = 30;
    const points = projectSmallCircleArc(plunge, 10, 70, 6);
    expect(points).toHaveLength(7);
    const expectedRadius = Math.tan(Math.PI / 4 - (plunge * Math.PI) / 360);
    for (const p of points) expect(radius(p)).toBeCloseTo(expectedRadius, 12);
  });

  test('endpoints match projectLine at the requested trends', () => {
    const points = projectSmallCircleArc(40, 100, 160, 12);
    const first = projectLine({ trend: 100, plunge: 40 });
    const last = projectLine({ trend: 160, plunge: 40 });
    expect(points[0]!.x).toBeCloseTo(first.x, 12);
    expect(points[0]!.y).toBeCloseTo(first.y, 12);
    expect(points[12]!.x).toBeCloseTo(last.x, 12);
    expect(points[12]!.y).toBeCloseTo(last.y, 12);
  });

  test('crosses 0°/360° continuously', () => {
    const points = projectSmallCircleArc(20, 350, 370, 4);
    expect(trendOf(points[0]!)).toBeCloseTo(350, 9);
    expect(trendOf(points[2]!)).toBeCloseTo(0, 9);
    expect(trendOf(points[4]!)).toBeCloseTo(10, 9);
  });

  test('a 360° sweep closes the loop', () => {
    const points = projectSmallCircleArc(25, 0, 360, 36);
    expect(points[0]!.x).toBeCloseTo(points[36]!.x, 12);
    expect(points[0]!.y).toBeCloseTo(points[36]!.y, 12);
  });

  test('a zero sweep repeats a single point', () => {
    const points = projectSmallCircleArc(25, 80, 80, 3);
    for (const p of points) {
      expect(p.x).toBeCloseTo(points[0]!.x, 12);
      expect(p.y).toBeCloseTo(points[0]!.y, 12);
    }
  });

  test('plunge 0° lies on the rim and plunge 90° at the centre', () => {
    for (const p of projectSmallCircleArc(0, 0, 90, 3)) expect(radius(p)).toBeCloseTo(1, 12);
    for (const p of projectSmallCircleArc(90, 0, 90, 3)) expect(radius(p)).toBeCloseTo(0, 12);
  });

  test('throws RangeError for invalid input', () => {
    expect(() => projectSmallCircleArc(-1, 0, 10, 4)).toThrow(RangeError);
    expect(() => projectSmallCircleArc(91, 0, 10, 4)).toThrow(RangeError);
    expect(() => projectSmallCircleArc(30, 10, 0, 4)).toThrow(RangeError);
    expect(() => projectSmallCircleArc(30, 0, 361, 4)).toThrow(RangeError);
    expect(() => projectSmallCircleArc(30, 0, 10, 0)).toThrow(RangeError);
    expect(() => projectSmallCircleArc(30, 0, 10, 1.5)).toThrow(RangeError);
    expect(() => projectSmallCircleArc(NaN, 0, 10, 4)).toThrow(RangeError);
    expect(() => projectSmallCircleArc(30, Infinity, 10, 4)).toThrow(RangeError);
  });
});

describe('projectLineSectorRings', () => {
  test('annular sector: one ring whose vertices lie on the two radii and within the trend range', () => {
    const [ring, ...rest] = projectLineSectorRings(20, 60, 180, 20, 1);
    expect(rest).toHaveLength(0);
    expect(ring).toBeDefined();
    const rOuter = Math.tan(Math.PI / 4 - (20 * Math.PI) / 360);
    const rInner = Math.tan(Math.PI / 4 - (60 * Math.PI) / 360);
    for (const p of ring!) {
      const r = radius(p);
      const onOuter = Math.abs(r - rOuter) < 1e-12;
      const onInner = Math.abs(r - rInner) < 1e-12;
      expect(onOuter || onInner).toBe(true);
      expect(Math.abs(trendOf(p) - 180)).toBeLessThanOrEqual(20 + 1e-9);
    }
    // 40 segments → 41 outer + 41 inner vertices.
    expect(ring).toHaveLength(82);
  });

  test('sector crossing North keeps trends within the range', () => {
    const [ring] = projectLineSectorRings(0, 30, 5, 20, 1);
    for (const p of ring!) {
      const t = trendOf(p);
      const delta = Math.min(Math.abs(t - 5), 360 - Math.abs(t - 5));
      expect(delta).toBeLessThanOrEqual(20 + 1e-9);
    }
  });

  test('maxPlunge 90° collapses the inner boundary to the centre vertex', () => {
    const [ring] = projectLineSectorRings(40, 90, 90, 20, 1);
    // 41 outer vertices + 1 centre vertex.
    expect(ring).toHaveLength(42);
    const last = ring![ring!.length - 1]!;
    expect(radius(last)).toBeCloseTo(0, 12);
  });

  test('halfWidth ≥ 180° gives a full annulus of two rings', () => {
    const rings = projectLineSectorRings(20, 60, 0, 180, 5);
    expect(rings).toHaveLength(2);
    expect(rings[0]).toHaveLength(72);
    expect(rings[1]).toHaveLength(72);
  });

  test('full disc when maxPlunge is 90° and halfWidth ≥ 180°', () => {
    const rings = projectLineSectorRings(0, 90, 0, 200, 5);
    expect(rings).toHaveLength(1);
  });

  test('returns an empty region when minPlunge ≥ maxPlunge', () => {
    expect(projectLineSectorRings(40, 40, 0, 20)).toEqual([]);
    expect(projectLineSectorRings(60, 20, 0, 20)).toEqual([]);
  });

  test('is deterministic', () => {
    expect(projectLineSectorRings(20, 60, 123, 20)).toEqual(
      projectLineSectorRings(20, 60, 123, 20),
    );
  });

  test('throws RangeError for invalid input', () => {
    expect(() => projectLineSectorRings(-1, 60, 0, 20)).toThrow(RangeError);
    expect(() => projectLineSectorRings(0, 91, 0, 20)).toThrow(RangeError);
    expect(() => projectLineSectorRings(0, 60, 0, 0)).toThrow(RangeError);
    expect(() => projectLineSectorRings(0, 60, 0, 361)).toThrow(RangeError);
    expect(() => projectLineSectorRings(0, 60, 0, 20, 0)).toThrow(RangeError);
    expect(() => projectLineSectorRings(0, 60, NaN, 20)).toThrow(RangeError);
  });
});
