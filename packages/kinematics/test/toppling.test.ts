import { describe, expect, it } from 'vitest';
import { evaluateDirectToppling } from '../src';

describe('evaluateDirectToppling', () => {
  // ── Admissible cases ──────────────────────────────────────────────────────

  it('returns admissible for a clear direct toppling case', () => {
    // Slope 180°/70°, discontinuity 000°/80°, φ=25°
    // Anti-parallel check: αd=0° ≈ αs+180°=360°=0° → Δα=0° < 20° ✓
    // Dip condition: 80° > (90°−70°)+25° = 45° ✓
    const result = evaluateDirectToppling(
      { dipDirection: 180, dip: 70 },
      { dipDirection: 0, dip: 80 },
      25,
    );
    expect(result.mode).toBe('directToppling');
    expect(result.isAdmissible).toBe(true);
    expect(result.rejectionReasons).toHaveLength(0);
    // dipExcess = 80 − (90−70+25) = 80 − 45 = 35°
    expect(result.dipExcess).toBeCloseTo(35, 10);
  });

  it('returns admissible when φ=0°', () => {
    // Slope 180°/70°, discontinuity 000°/21°, φ=0°
    // Dip condition: 21 > (90−70)+0 = 20 ✓
    const result = evaluateDirectToppling(
      { dipDirection: 180, dip: 70 },
      { dipDirection: 0, dip: 21 },
      0,
    );
    expect(result.isAdmissible).toBe(true);
    expect(result.dipExcess).toBeCloseTo(1, 10);
  });

  it('handles azimuth wrapping: αs=355°, αd=175° → anti-parallel target 175° → admissible', () => {
    // αs=355°, anti-parallel target = 355+180=535 → normalizeAzimuth → 175°
    // αd=175° → Δα=0° < 20° ✓
    // Dip: 80 > (90−70)+25 = 45 ✓
    const result = evaluateDirectToppling(
      { dipDirection: 355, dip: 70 },
      { dipDirection: 175, dip: 80 },
      25,
    );
    expect(result.isAdmissible).toBe(true);
  });

  // ── Azimuth condition failures ────────────────────────────────────────────

  it('rejects when dip direction is not anti-parallel to slope', () => {
    // Slope 180°/70°: anti-parallel target = 0°. αd=90° → Δα=90° > 20°
    const result = evaluateDirectToppling(
      { dipDirection: 180, dip: 70 },
      { dipDirection: 90, dip: 80 },
      25,
    );
    expect(result.isAdmissible).toBe(false);
    expect(result.rejectionReasons).toContain('azimuthSectorFailed');
  });

  it('rejects when azimuth offset is exactly 20° from anti-parallel (strict boundary)', () => {
    // Slope 180°/70°: anti-parallel target = 0°. αd=20° → Δα=20° exactly → NOT admissible
    const result = evaluateDirectToppling(
      { dipDirection: 180, dip: 70 },
      { dipDirection: 20, dip: 80 },
      25,
    );
    expect(result.isAdmissible).toBe(false);
    expect(result.rejectionReasons).toContain('azimuthSectorFailed');
  });

  // ── Dip condition failures ────────────────────────────────────────────────

  it('rejects when dip is insufficient for toppling', () => {
    // Slope 180°/70°, discontinuity 000°/40°, φ=25°
    // Threshold = 90−70+25 = 45°; 40 < 45 → FAILS
    const result = evaluateDirectToppling(
      { dipDirection: 180, dip: 70 },
      { dipDirection: 0, dip: 40 },
      25,
    );
    expect(result.isAdmissible).toBe(false);
    expect(result.rejectionReasons).toContain('frictionConditionFailed');
    expect(result.dipExcess).toBeCloseTo(-5, 10);
  });

  it('rejects when dip is exactly at the toppling threshold (strict boundary)', () => {
    // Slope 180°/70°, discontinuity 000°/45°, φ=25°
    // Threshold = 45°; 45 = 45 → NOT admissible (strict >)
    const result = evaluateDirectToppling(
      { dipDirection: 180, dip: 70 },
      { dipDirection: 0, dip: 45 },
      25,
    );
    expect(result.isAdmissible).toBe(false);
    expect(result.rejectionReasons).toContain('frictionConditionFailed');
    expect(result.dipExcess).toBeCloseTo(0, 10);
  });

  // ── Degenerate inputs ─────────────────────────────────────────────────────

  it('rejects horizontal slope with horizontalSlope', () => {
    const result = evaluateDirectToppling(
      { dipDirection: 0, dip: 0 },
      { dipDirection: 180, dip: 80 },
      25,
    );
    expect(result.isAdmissible).toBe(false);
    expect(result.rejectionReasons).toContain('horizontalSlope');
  });

  // ── isAdmissible invariant ────────────────────────────────────────────────

  it('maintains isAdmissible ↔ empty rejectionReasons invariant', () => {
    const cases = [
      evaluateDirectToppling({ dipDirection: 180, dip: 70 }, { dipDirection: 0, dip: 80 }, 25),
      evaluateDirectToppling({ dipDirection: 180, dip: 70 }, { dipDirection: 90, dip: 80 }, 25),
      evaluateDirectToppling({ dipDirection: 180, dip: 70 }, { dipDirection: 0, dip: 40 }, 25),
      evaluateDirectToppling({ dipDirection: 0, dip: 0 }, { dipDirection: 180, dip: 80 }, 25),
    ];
    for (const r of cases) {
      expect(r.isAdmissible).toBe(r.rejectionReasons.length === 0);
    }
  });

  // ── Non-finite input guard ────────────────────────────────────────────────

  it('throws RangeError for NaN friction angle', () => {
    expect(() =>
      evaluateDirectToppling({ dipDirection: 180, dip: 70 }, { dipDirection: 0, dip: 80 }, NaN),
    ).toThrow(RangeError);
  });

  it('throws RangeError for Infinity dip', () => {
    expect(() =>
      evaluateDirectToppling(
        { dipDirection: 180, dip: Infinity },
        { dipDirection: 0, dip: 80 },
        25,
      ),
    ).toThrow(RangeError);
  });
});
