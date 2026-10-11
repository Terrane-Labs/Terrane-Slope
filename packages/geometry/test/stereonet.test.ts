import { describe, expect, test } from 'vitest';
import type {
  LineOrientation,
  PlaneOrientation,
  Vector3,
  StereonetPoint,
} from '@terrane-labs/domain';
import { CANONICAL_EPSILON } from '../src/tolerance';
import { vec3IsUnit, vec3Magnitude } from '../src/vector';
import {
  normalizeLineOrientation,
  lineVectorFromOrientation,
  lineOrientationFromVector,
  selectDownwardDirection,
  projectLine,
  unprojectLine,
  projectPlanePole,
  projectPlaneGreatCircle,
  projectSmallCircle,
} from '../src/stereonet';

function expectPointCloseTo(actual: StereonetPoint, expected: StereonetPoint) {
  expect(actual.x).toBeCloseTo(expected.x, 10);
  expect(actual.y).toBeCloseTo(expected.y, 10);
}

function expectVectorCloseTo(actual: Vector3, expected: Vector3) {
  expect(actual.x).toBeCloseTo(expected.x, 10);
  expect(actual.y).toBeCloseTo(expected.y, 10);
  expect(actual.z).toBeCloseTo(expected.z, 10);
}

describe('Stereonet Mathematics & Projection', () => {
  describe('LINE/VECTOR', () => {
    test('canonical directions to vectors', () => {
      // North horizontal
      expectVectorCloseTo(lineVectorFromOrientation({ trend: 0, plunge: 0 }), { x: 0, y: 1, z: 0 });
      // East horizontal
      expectVectorCloseTo(lineVectorFromOrientation({ trend: 90, plunge: 0 }), {
        x: 1,
        y: 0,
        z: 0,
      });
      // South horizontal
      expectVectorCloseTo(lineVectorFromOrientation({ trend: 180, plunge: 0 }), {
        x: 0,
        y: -1,
        z: 0,
      });
      // West horizontal
      expectVectorCloseTo(lineVectorFromOrientation({ trend: 270, plunge: 0 }), {
        x: -1,
        y: 0,
        z: 0,
      });
      // Vertical downward
      expectVectorCloseTo(lineVectorFromOrientation({ trend: 42, plunge: 90 }), {
        x: 0,
        y: 0,
        z: -1,
      });
    });

    test('oblique line', () => {
      const v = lineVectorFromOrientation({ trend: 45, plunge: 45 });
      expect(vec3IsUnit(v)).toBe(true);
      expect(v.z).toBeCloseTo(-Math.sin(Math.PI / 4), 10);
      expect(v.x).toBeCloseTo(0.5, 10);
      expect(v.y).toBeCloseTo(0.5, 10);
    });

    test('vector to orientation', () => {
      expect(lineOrientationFromVector({ x: 0, y: 1, z: 0 })).toEqual({ trend: 0, plunge: 0 });
      expect(lineOrientationFromVector({ x: 1, y: 0, z: 0 })).toEqual({ trend: 90, plunge: 0 });
      expect(lineOrientationFromVector({ x: 0, y: -1, z: 0 })).toEqual({ trend: 180, plunge: 0 });
      expect(lineOrientationFromVector({ x: -1, y: 0, z: 0 })).toEqual({ trend: 270, plunge: 0 });
      expect(lineOrientationFromVector({ x: 0, y: 0, z: -1 })).toEqual({ trend: 0, plunge: 90 });
    });

    test('vector -> orientation -> vector round trip', () => {
      const original: Vector3 = { x: 1, y: 2, z: -3 };
      const orientation = lineOrientationFromVector(original);
      const reconstructed = lineVectorFromOrientation(orientation);
      const expected = { x: 1 / Math.sqrt(14), y: 2 / Math.sqrt(14), z: -3 / Math.sqrt(14) };
      expectVectorCloseTo(reconstructed, expected);
    });

    test('zero vector rejection', () => {
      expect(() => lineOrientationFromVector({ x: 0, y: 0, z: 0 })).toThrow(RangeError);
    });

    test('normalization behavior and validation', () => {
      expect(normalizeLineOrientation({ trend: 360, plunge: 45 })).toEqual({
        trend: 0,
        plunge: 45,
      });
      expect(normalizeLineOrientation({ trend: -90, plunge: 45 })).toEqual({
        trend: 270,
        plunge: 45,
      });

      expect(() => normalizeLineOrientation({ trend: 0, plunge: -1 })).toThrow(RangeError);
      expect(() => normalizeLineOrientation({ trend: 0, plunge: 91 })).toThrow(RangeError);
      expect(() => normalizeLineOrientation({ trend: NaN, plunge: 45 })).toThrow(RangeError);
      expect(() => normalizeLineOrientation({ trend: 0, plunge: Infinity })).toThrow(RangeError);
    });

    test('upper hemisphere rejection', () => {
      expect(() => lineOrientationFromVector({ x: 0, y: 1, z: 0.5 })).toThrow(RangeError);

      // Floating point noise slightly above 0 but within epsilon should be accepted and clamped
      const v = { x: 0, y: 1, z: CANONICAL_EPSILON / 2 };
      expect(lineOrientationFromVector(v).plunge).toBe(0);

      // Outside epsilon should be rejected
      expect(() => lineOrientationFromVector({ x: 0, y: 1, z: CANONICAL_EPSILON * 2 })).toThrow(
        RangeError,
      );
    });
  });

  describe('PROJECTION', () => {
    test('canonical directions projection', () => {
      expectPointCloseTo(projectLine({ trend: 0, plunge: 0 }), { x: 0, y: 1 });
      expectPointCloseTo(projectLine({ trend: 90, plunge: 0 }), { x: 1, y: 0 });
      expectPointCloseTo(projectLine({ trend: 180, plunge: 0 }), { x: 0, y: -1 });
      expectPointCloseTo(projectLine({ trend: 270, plunge: 0 }), { x: -1, y: 0 });
      expectPointCloseTo(projectLine({ trend: 123, plunge: 90 }), { x: 0, y: 0 });
    });

    test('oblique orientation projection', () => {
      const p = projectLine({ trend: 45, plunge: 45 });
      const r = Math.tan(Math.PI / 8);
      const val = r * Math.sin(Math.PI / 4);
      expectPointCloseTo(p, { x: val, y: val });
    });

    test('projection -> inverse round trip', () => {
      const orig = { trend: 123.45, plunge: 67.89 };
      const point = projectLine(orig);
      const unproj = unprojectLine(point);
      expect(unproj.trend).toBeCloseTo(orig.trend, 10);
      expect(unproj.plunge).toBeCloseTo(orig.plunge, 10);
    });

    test('unit disk invariant for inverse projection', () => {
      expect(() => unprojectLine({ x: 2, y: 0 })).toThrow(RangeError);
      // Small overshoot within epsilon is clamped
      const unproj = unprojectLine({ x: 1 + CANONICAL_EPSILON / 2, y: 0 });
      expect(unproj.plunge).toBe(0);
    });

    test('inverse projection exactly at center returns deterministic trend', () => {
      expect(unprojectLine({ x: 0, y: 0 })).toEqual({ trend: 0, plunge: 90 });
    });
  });

  describe('PLANE POLES', () => {
    test('horizontal plane pole is vertical downward', () => {
      const pole = projectPlanePole({ dipDirection: 0, dip: 0 });
      expectPointCloseTo(pole, { x: 0, y: 0 });
    });

    test('vertical planes', () => {
      // East striking plane (dipDir 180), vertical -> pole should be at North rim (0, 1) or South rim (0, -1)?
      // Upward canonical normal for (dipDir 180, dip 90) is (0, 1, 0)
      // Downward pole is (0, -1, 0) -> projects to South rim (0, -1)
      const poleEast = projectPlanePole({ dipDirection: 180, dip: 90 });
      expectPointCloseTo(poleEast, { x: 0, y: -1 });

      const poleNorth = projectPlanePole({ dipDirection: 90, dip: 90 });
      // Normal points Up canonical? (x=1, y=0, z=0). Actually canonicalizeNormal prefers x > 0 if z=0.
      // So Normal is (1, 0, 0). Downward pole is (-1, 0, 0). Projects to West rim (-1, 0)
      expectPointCloseTo(poleNorth, { x: -1, y: 0 });
    });

    test('dipping planes', () => {
      // Dipping 45 towards East (90)
      // Normal points West and Up.
      // Downward pole points East and Down.
      const pole = projectPlanePole({ dipDirection: 90, dip: 45 });
      const unproj = unprojectLine(pole);
      expect(unproj.trend).toBeCloseTo(270, 10);
      expect(unproj.plunge).toBeCloseTo(45, 10);
    });
  });

  describe('GREAT CIRCLES', () => {
    test('horizontal plane', () => {
      const points = projectPlaneGreatCircle({ dipDirection: 0, dip: 0 }, 4);
      expect(points.length).toBe(5);

      // Expected to trace the rim (r=1)
      for (const p of points) {
        expect(Math.hypot(p.x, p.y)).toBeCloseTo(1, 10);
      }

      // First and last point should coincide
      expectPointCloseTo(points[0], points[4]);
    });

    test('vertical plane', () => {
      // Striking North (dipDir 90), dip 90
      const points = projectPlaneGreatCircle({ dipDirection: 90, dip: 90 }, 2);
      expect(points.length).toBe(3);

      // Should go from North rim, through center, to South rim
      expectPointCloseTo(points[0], { x: 0, y: 1 });
      expectPointCloseTo(points[1], { x: 0, y: 0 });
      expectPointCloseTo(points[2], { x: 0, y: -1 });
    });

    test('representative dipping planes', () => {
      // Striking North, dipping 45 East (dipDir 90)
      const points = projectPlaneGreatCircle({ dipDirection: 90, dip: 45 }, 4);
      expect(points.length).toBe(5);

      // Starts at North rim
      expectPointCloseTo(points[0], { x: 0, y: 1 });
      // Ends at South rim
      expectPointCloseTo(points[4], { x: 0, y: -1 });

      for (const p of points) {
        // all inside or on unit disk
        expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(1 + CANONICAL_EPSILON);
      }
    });

    test('custom segment counts', () => {
      const points = projectPlaneGreatCircle({ dipDirection: 0, dip: 45 }, 360);
      expect(points.length).toBe(361);
    });

    test('validation', () => {
      expect(() => projectPlaneGreatCircle({ dipDirection: 0, dip: 45 }, 0)).toThrow(RangeError);
      expect(() => projectPlaneGreatCircle({ dipDirection: 0, dip: 45 }, -1)).toThrow(RangeError);
      expect(() => projectPlaneGreatCircle({ dipDirection: 0, dip: 45 }, 1.5)).toThrow(RangeError);
      expect(() => projectPlaneGreatCircle({ dipDirection: NaN, dip: 45 })).toThrow(RangeError);
    });
  });

  describe('SELECT DOWNWARD DIRECTION', () => {
    test('clearly upward vector is negated to downward', () => {
      const v = { x: 0, y: 0, z: 1 };
      const downward = selectDownwardDirection(v);
      expectVectorCloseTo(downward, { x: 0, y: 0, z: -1 });
      expect(vec3IsUnit(downward)).toBe(true);
    });

    test('clearly downward vector is preserved', () => {
      const v = { x: 0, y: 0, z: -1 };
      const downward = selectDownwardDirection(v);
      expectVectorCloseTo(downward, { x: 0, y: 0, z: -1 });
      expect(vec3IsUnit(downward)).toBe(true);
    });

    test('oblique upward vector is normalized and negated to downward', () => {
      const v = { x: 1, y: 2, z: 3 };
      const downward = selectDownwardDirection(v);
      const len = Math.hypot(1, 2, 3);
      expectVectorCloseTo(downward, { x: -1 / len, y: -2 / len, z: -3 / len });
      expect(downward.z).toBeLessThan(0);
      expect(vec3IsUnit(downward)).toBe(true);
    });

    test('oblique downward vector is normalized and preserved as downward', () => {
      const v = { x: 1, y: 2, z: -3 };
      const downward = selectDownwardDirection(v);
      const len = Math.hypot(1, 2, 3);
      expectVectorCloseTo(downward, { x: 1 / len, y: 2 / len, z: -3 / len });
      expect(downward.z).toBeLessThan(0);
      expect(vec3IsUnit(downward)).toBe(true);
    });

    test('horizontal vector tie-breaking: prefer x > 0', () => {
      // East (x = 1) -> preserved
      const east = selectDownwardDirection({ x: 1, y: 0, z: 0 });
      expectVectorCloseTo(east, { x: 1, y: 0, z: 0 });

      // West (x = -1) -> negated to East
      const west = selectDownwardDirection({ x: -1, y: 0, z: 0 });
      expectVectorCloseTo(west, { x: 1, y: 0, z: 0 });
    });

    test('horizontal vector tie-breaking: when x = 0, prefer y >= 0', () => {
      // North (y = 1) -> preserved
      const north = selectDownwardDirection({ x: 0, y: 1, z: 0 });
      expectVectorCloseTo(north, { x: 0, y: 1, z: 0 });

      // South (y = -1) -> negated to North
      const south = selectDownwardDirection({ x: 0, y: -1, z: 0 });
      expectVectorCloseTo(south, { x: 0, y: 1, z: 0 });
    });

    test('zeroes small components within CANONICAL_EPSILON', () => {
      const v = { x: CANONICAL_EPSILON / 2, y: 1, z: -CANONICAL_EPSILON / 2 };
      const downward = selectDownwardDirection(v);
      expect(downward.x).toBe(0);
      expect(downward.y).toBe(1);
      expect(downward.z).toBe(0);
    });

    test('throws RangeError for near-zero vector', () => {
      expect(() => selectDownwardDirection({ x: 0, y: 0, z: 0 })).toThrow(RangeError);
      expect(() => selectDownwardDirection({ x: CANONICAL_EPSILON / 2, y: 0, z: 0 })).toThrow(
        RangeError,
      );
    });

    test('integration: downward direction always passes lineOrientationFromVector without error', () => {
      const testVectors: Vector3[] = [
        { x: 0, y: 0, z: 1 },
        { x: 0, y: 0, z: -1 },
        { x: 3, y: -4, z: 5 },
        { x: -3, y: 4, z: -5 },
        { x: 1, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: -1, z: 0 },
      ];

      for (const v of testVectors) {
        const downward = selectDownwardDirection(v);
        expect(() => {
          const orientation = lineOrientationFromVector(downward);
          expect(orientation.plunge).toBeGreaterThanOrEqual(0);
          expect(orientation.plunge).toBeLessThanOrEqual(90);
          expect(orientation.trend).toBeGreaterThanOrEqual(0);
          expect(orientation.trend).toBeLessThan(360);
        }).not.toThrow();
      }
    });
  });

  describe('SMALL CIRCLES', () => {
    test('horizontal small circle (plunge = 0°) traces the rim at r = 1', () => {
      const points = projectSmallCircle(0, 4);
      expect(points.length).toBe(5);

      for (const p of points) {
        expect(Math.hypot(p.x, p.y)).toBeCloseTo(1, 10);
      }

      // First and last point coincide
      expectPointCloseTo(points[0], points[4]);
      // Cardinal points: N (0, 1), E (1, 0), S (0, -1), W (-1, 0), N (0, 1)
      expectPointCloseTo(points[0], { x: 0, y: 1 });
      expectPointCloseTo(points[1], { x: 1, y: 0 });
      expectPointCloseTo(points[2], { x: 0, y: -1 });
      expectPointCloseTo(points[3], { x: -1, y: 0 });
      expectPointCloseTo(points[4], { x: 0, y: 1 });
    });

    test('vertical small circle (plunge = 90°) collapses to the center (0, 0)', () => {
      const points = projectSmallCircle(90, 8);
      expect(points.length).toBe(9);

      for (const p of points) {
        expectPointCloseTo(p, { x: 0, y: 0 });
      }
    });

    test('oblique small circle (plunge = 45°) has radius tan(π/8)', () => {
      const expectedRadius = Math.tan(Math.PI / 8);
      const points = projectSmallCircle(45, 12);
      expect(points.length).toBe(13);

      for (const p of points) {
        expect(Math.hypot(p.x, p.y)).toBeCloseTo(expectedRadius, 10);
      }

      expectPointCloseTo(points[0], points[12]);
    });

    test('round trip: unprojecting points recovers original plunge', () => {
      const testPlunges = [15, 30, 45, 60, 75];
      for (const plunge of testPlunges) {
        const points = projectSmallCircle(plunge, 8);
        for (const p of points) {
          const unproj = unprojectLine(p);
          expect(unproj.plunge).toBeCloseTo(plunge, 10);
        }
      }
    });

    test('default segment count produces 181 points', () => {
      const points = projectSmallCircle(35);
      expect(points.length).toBe(181);
      expectPointCloseTo(points[0], points[180]);
    });

    test('all points satisfy the unit disk invariant', () => {
      const points = projectSmallCircle(25, 360);
      for (const p of points) {
        expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(1 + CANONICAL_EPSILON);
      }
    });

    test('validation errors on invalid plunge or segments', () => {
      expect(() => projectSmallCircle(-1)).toThrow(RangeError);
      expect(() => projectSmallCircle(90.1)).toThrow(RangeError);
      expect(() => projectSmallCircle(NaN)).toThrow(RangeError);
      expect(() => projectSmallCircle(Infinity)).toThrow(RangeError);
      expect(() => projectSmallCircle(45, 0)).toThrow(RangeError);
      expect(() => projectSmallCircle(45, -1)).toThrow(RangeError);
      expect(() => projectSmallCircle(45, 2.5)).toThrow(RangeError);
      expect(() => projectSmallCircle(45, NaN)).toThrow(RangeError);
    });
  });
});
