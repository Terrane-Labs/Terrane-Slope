import { describe, expect, it } from 'vitest';
import { evaluatePlanarSliding } from '../src';

describe('evaluatePlanarSliding', () => {
  // ── Admissible cases ──────────────────────────────────────────────────────

  it('returns admissible for a clear planar sliding case', () => {
    // Slope 270°/70°, discontinuity 270°/50°, φ=25°
    // Daylight: 50 < 70 ✓  Friction: 50 > 25 ✓  Azimuth: Δα=0° < 20° ✓
    const result = evaluatePlanarSliding(
      { dipDirection: 270, dip: 70 },
      { dipDirection: 270, dip: 50 },
      25,
    );
    expect(result.mode).toBe('planarSliding');
    expect(result.isAdmissible).toBe(true);
    expect(result.rejectionReasons).toHaveLength(0);
    expect(result.daylightExcess).toBeCloseTo(20, 10);
    expect(result.frictionExcess).toBeCloseTo(25, 10);
  });

  it('returns admissible when φ=0° (any dipping plane satisfies friction)', () => {
    // Friction circle degenerates to center; any δd > 0 passes
    const result = evaluatePlanarSliding(
      { dipDirection: 270, dip: 70 },
      { dipDirection: 270, dip: 5 },
      0,
    );
    expect(result.isAdmissible).toBe(true);
    expect(result.frictionExcess).toBeCloseTo(5, 10);
  });

  it('handles azimuth wrapping: αd=359°, αs=1° → Δα=2° < 20° (admissible)', () => {
    const result = evaluatePlanarSliding(
      { dipDirection: 1, dip: 70 },
      { dipDirection: 359, dip: 50 },
      25,
    );
    expect(result.isAdmissible).toBe(true);
  });

  it('handles azimuth wrapping: αd=1°, αs=359° → Δα=2° < 20° (admissible)', () => {
    const result = evaluatePlanarSliding(
      { dipDirection: 359, dip: 70 },
      { dipDirection: 1, dip: 50 },
      25,
    );
    expect(result.isAdmissible).toBe(true);
  });

  // ── Daylight condition failures ───────────────────────────────────────────

  it('rejects when discontinuity dip equals slope dip (strict boundary)', () => {
    // δd = δs = 50° → daylight exactly on boundary → NOT admissible
    const result = evaluatePlanarSliding(
      { dipDirection: 270, dip: 50 },
      { dipDirection: 270, dip: 50 },
      25,
    );
    expect(result.isAdmissible).toBe(false);
    expect(result.rejectionReasons).toContain('daylightConditionFailed');
  });

  it('rejects when discontinuity dip exceeds slope dip', () => {
    const result = evaluatePlanarSliding(
      { dipDirection: 270, dip: 40 },
      { dipDirection: 270, dip: 50 },
      25,
    );
    expect(result.isAdmissible).toBe(false);
    expect(result.rejectionReasons).toContain('daylightConditionFailed');
    expect(result.daylightExcess).toBeCloseTo(-10, 10);
  });

  // ── Friction condition failures ───────────────────────────────────────────

  it('rejects when discontinuity dip equals friction angle (strict boundary)', () => {
    // δd = φ = 25° → exactly at friction limit → NOT admissible
    const result = evaluatePlanarSliding(
      { dipDirection: 270, dip: 70 },
      { dipDirection: 270, dip: 25 },
      25,
    );
    expect(result.isAdmissible).toBe(false);
    expect(result.rejectionReasons).toContain('frictionConditionFailed');
    expect(result.frictionExcess).toBeCloseTo(0, 10);
  });

  it('rejects when discontinuity dip is below friction angle', () => {
    const result = evaluatePlanarSliding(
      { dipDirection: 270, dip: 70 },
      { dipDirection: 270, dip: 20 },
      25,
    );
    expect(result.isAdmissible).toBe(false);
    expect(result.rejectionReasons).toContain('frictionConditionFailed');
    expect(result.frictionExcess).toBeCloseTo(-5, 10);
  });

  // ── Azimuth sector failures ───────────────────────────────────────────────

  it('rejects when azimuth is outside ±20° sector', () => {
    // αs=000°, αd=090° → Δα=90° >> 20°
    const result = evaluatePlanarSliding(
      { dipDirection: 0, dip: 70 },
      { dipDirection: 90, dip: 50 },
      25,
    );
    expect(result.isAdmissible).toBe(false);
    expect(result.rejectionReasons).toContain('azimuthSectorFailed');
  });

  it('rejects when azimuth difference is exactly 20° (strict boundary)', () => {
    // αs=000°, αd=020° → Δα exactly 20° → NOT admissible
    const result = evaluatePlanarSliding(
      { dipDirection: 0, dip: 70 },
      { dipDirection: 20, dip: 50 },
      25,
    );
    expect(result.isAdmissible).toBe(false);
    expect(result.rejectionReasons).toContain('azimuthSectorFailed');
  });

  it('rejects for anti-parallel dip directions (180° apart)', () => {
    const result = evaluatePlanarSliding(
      { dipDirection: 0, dip: 70 },
      { dipDirection: 180, dip: 50 },
      25,
    );
    expect(result.isAdmissible).toBe(false);
    expect(result.rejectionReasons).toContain('azimuthSectorFailed');
  });

  // ── Degenerate inputs ─────────────────────────────────────────────────────

  it('rejects horizontal discontinuity with horizontalPlane', () => {
    const result = evaluatePlanarSliding(
      { dipDirection: 270, dip: 70 },
      { dipDirection: 0, dip: 0 },
      25,
    );
    expect(result.isAdmissible).toBe(false);
    expect(result.rejectionReasons).toContain('horizontalPlane');
  });

  it('rejects horizontal slope with horizontalSlope', () => {
    const result = evaluatePlanarSliding(
      { dipDirection: 0, dip: 0 },
      { dipDirection: 270, dip: 50 },
      25,
    );
    expect(result.isAdmissible).toBe(false);
    expect(result.rejectionReasons).toContain('horizontalSlope');
  });

  // ── Multiple failure reasons ──────────────────────────────────────────────

  it('accumulates multiple rejection reasons when both daylight and azimuth fail', () => {
    // δd=50 > δs=30 (daylight fails), and αd=90 away from αs=0 (azimuth fails)
    const result = evaluatePlanarSliding(
      { dipDirection: 0, dip: 30 },
      { dipDirection: 90, dip: 50 },
      25,
    );
    expect(result.isAdmissible).toBe(false);
    expect(result.rejectionReasons).toContain('daylightConditionFailed');
    expect(result.rejectionReasons).toContain('azimuthSectorFailed');
  });

  // ── isAdmissible invariant ────────────────────────────────────────────────

  it('maintains isAdmissible ↔ empty rejectionReasons invariant', () => {
    const cases = [
      evaluatePlanarSliding({ dipDirection: 270, dip: 70 }, { dipDirection: 270, dip: 50 }, 25),
      evaluatePlanarSliding({ dipDirection: 270, dip: 40 }, { dipDirection: 270, dip: 50 }, 25),
      evaluatePlanarSliding({ dipDirection: 0, dip: 0 }, { dipDirection: 270, dip: 50 }, 25),
    ];
    for (const r of cases) {
      expect(r.isAdmissible).toBe(r.rejectionReasons.length === 0);
    }
  });

  // ── Non-finite input guard ────────────────────────────────────────────────

  it('throws RangeError for NaN dip', () => {
    expect(() =>
      evaluatePlanarSliding({ dipDirection: 270, dip: NaN }, { dipDirection: 270, dip: 50 }, 25),
    ).toThrow(RangeError);
  });

  it('throws RangeError for Infinity azimuth', () => {
    expect(() =>
      evaluatePlanarSliding(
        { dipDirection: Infinity, dip: 70 },
        { dipDirection: 270, dip: 50 },
        25,
      ),
    ).toThrow(RangeError);
  });
});
