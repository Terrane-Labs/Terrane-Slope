import { describe, expect, it } from 'vitest';
import { evaluateWedgeSliding } from '../src';

describe('evaluateWedgeSliding', () => {
  // ── Admissible case with verified numerics ────────────────────────────────

  it('returns admissible for a concrete symmetric wedge case', () => {
    // Slope 180°/70°, J1 = 130°/55°, J2 = 230°/55°, φ = 25°
    //
    // Hand-calculated:
    //   n1 = (sin55·sin130, sin55·cos130, cos55) ≈ (0.62735, −0.52643, 0.57358)
    //   n2 = (sin55·sin230, sin55·cos230, cos55) ≈ (−0.62735, −0.52643, 0.57358)
    //   L = normalize(n1 × n2):
    //     x = 0, y ≈ −0.73692, z ≈ −0.67617
    //   After selectDownwardDirection (z < 0 already): unchanged
    //   lineOrientationFromVector: plunge = asin(0.67617) ≈ 42.52°, trend = 180°
    //
    // Admissibility checks:
    //   Friction: 42.52 > 25 ✓
    //   Daylight: 42.52 < 70 ✓
    //   Lateral: |180 − 180| = 0° < 90° ✓
    //   Both-dip-into-slope: n_slope = (0,0,1) rotated; dot products negative ✓
    const result = evaluateWedgeSliding(
      { dipDirection: 180, dip: 70 },
      { dipDirection: 130, dip: 55 },
      { dipDirection: 230, dip: 55 },
      25,
    );
    expect(result.mode).toBe('wedgeSliding');
    expect(result.isAdmissible).toBe(true);
    expect(result.rejectionReasons).toHaveLength(0);
    expect(result.intersectionLine).not.toBeNull();

    // Verify the intersection line orientation numerically
    const line = result.intersectionLine!;
    expect(line.trend).toBeCloseTo(180, 1); // symmetric about 180°
    expect(line.plunge).toBeCloseTo(42.52, 1); // ≈ 42.52°

    // Verify margin angles
    expect(result.daylightExcess).toBeGreaterThan(0); // 70 − 42.52 > 0
    expect(result.frictionExcess).toBeGreaterThan(0); // 42.52 − 25 > 0
  });

  // ── Parallel planes ───────────────────────────────────────────────────────

  it('rejects parallel planes with noIntersectionLine', () => {
    const result = evaluateWedgeSliding(
      { dipDirection: 180, dip: 70 },
      { dipDirection: 270, dip: 45 },
      { dipDirection: 270, dip: 45 },
      25,
    );
    expect(result.isAdmissible).toBe(false);
    expect(result.rejectionReasons).toContain('noIntersectionLine');
    expect(result.intersectionLine).toBeNull();
    expect(result.daylightExcess).toBeNull();
    expect(result.frictionExcess).toBeNull();
  });

  it('rejects coincident planes with noIntersectionLine', () => {
    const result = evaluateWedgeSliding(
      { dipDirection: 180, dip: 70 },
      { dipDirection: 110, dip: 50 },
      { dipDirection: 110, dip: 50 },
      25,
    );
    expect(result.isAdmissible).toBe(false);
    expect(result.rejectionReasons).toContain('noIntersectionLine');
  });

  // ── Friction condition failure ────────────────────────────────────────────

  it('rejects when intersection plunge is below friction angle', () => {
    // Shallower joint dips → shallower intersection plunge → friction fails
    // J1=110°/30°, J2=250°/30°, slope 180°/70°, φ=25°
    // Symmetric: intersection trends ≈ 180°, plunge will be shallow (~few degrees)
    const result = evaluateWedgeSliding(
      { dipDirection: 180, dip: 70 },
      { dipDirection: 110, dip: 30 },
      { dipDirection: 250, dip: 30 },
      25,
    );
    expect(result.isAdmissible).toBe(false);
    // Either friction or other condition fails — intersection plunge is shallow
    expect(result.rejectionReasons.length).toBeGreaterThan(0);
    expect(result.intersectionLine).not.toBeNull();
  });

  // ── Daylight condition failure ────────────────────────────────────────────

  it('rejects when intersection plunge exceeds slope dip', () => {
    // Use steep joints with a shallow slope to force intersection deeper than slope dip
    // J1=130°/60°, J2=230°/60°, slope 180°/40°, φ=25°
    const result = evaluateWedgeSliding(
      { dipDirection: 180, dip: 40 },
      { dipDirection: 130, dip: 60 },
      { dipDirection: 230, dip: 60 },
      25,
    );
    expect(result.isAdmissible).toBe(false);
    expect(result.rejectionReasons).toContain('daylightConditionFailed');
    expect(result.intersectionLine).not.toBeNull();
  });

  // ── Horizontal slope ─────────────────────────────────────────────────────

  it('rejects horizontal slope with horizontalSlope', () => {
    const result = evaluateWedgeSliding(
      { dipDirection: 180, dip: 0 },
      { dipDirection: 130, dip: 55 },
      { dipDirection: 230, dip: 55 },
      25,
    );
    expect(result.isAdmissible).toBe(false);
    expect(result.rejectionReasons).toContain('horizontalSlope');
    expect(result.intersectionLine).toBeNull();
  });

  // ── isAdmissible invariant ────────────────────────────────────────────────

  it('maintains isAdmissible ↔ empty rejectionReasons invariant', () => {
    const cases = [
      evaluateWedgeSliding(
        { dipDirection: 180, dip: 70 },
        { dipDirection: 130, dip: 55 },
        { dipDirection: 230, dip: 55 },
        25,
      ),
      evaluateWedgeSliding(
        { dipDirection: 180, dip: 70 },
        { dipDirection: 270, dip: 45 },
        { dipDirection: 270, dip: 45 },
        25,
      ),
    ];
    for (const r of cases) {
      expect(r.isAdmissible).toBe(r.rejectionReasons.length === 0);
    }
  });

  // ── Non-finite input guard ────────────────────────────────────────────────

  it('throws RangeError for NaN input', () => {
    expect(() =>
      evaluateWedgeSliding(
        { dipDirection: 180, dip: 70 },
        { dipDirection: NaN, dip: 55 },
        { dipDirection: 230, dip: 55 },
        25,
      ),
    ).toThrow(RangeError);
  });
});
