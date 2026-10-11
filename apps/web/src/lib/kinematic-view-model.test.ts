import { describe, expect, it } from 'vitest';
import type { KinematicRejectionReason } from '@terrane-labs/domain';
import {
  DEFAULT_PARAMETER_STATE,
  REJECTION_LABELS,
  analyzePlane,
  buildOverlayLayers,
  parseKinematicParameters,
  updateParameterState,
} from './kinematic-view-model';

const PARAMS = DEFAULT_PARAMETER_STATE.valid; // slope 60°/130°, φ = 30°

const field = (fields: ReadonlyArray<{ name: string; value: string }>, name: string) =>
  fields.find((f) => f.name === name)?.value;

describe('REJECTION_LABELS', () => {
  it('has a non-empty label for every rejection reason', () => {
    const reasons: KinematicRejectionReason[] = [
      'noIntersectionLine',
      'daylightConditionFailed',
      'frictionConditionFailed',
      'azimuthSectorFailed',
      'horizontalPlane',
      'horizontalSlope',
    ];
    for (const reason of reasons) expect(REJECTION_LABELS[reason].length).toBeGreaterThan(0);
    expect(Object.keys(REJECTION_LABELS).sort()).toEqual([...reasons].sort());
  });
});

describe('parseKinematicParameters', () => {
  const ok = { dipDirection: '130', dip: '60', friction: '30' };

  it('accepts valid inputs, including boundary values', () => {
    expect(parseKinematicParameters(ok)).toEqual({
      ok: true,
      value: { slope: { dipDirection: 130, dip: 60 }, frictionAngle: 30 },
    });
    expect(parseKinematicParameters({ dipDirection: '360', dip: '90', friction: '0' }).ok).toBe(
      true,
    );
  });

  it('rejects empty, non-numeric, and out-of-range values', () => {
    expect(parseKinematicParameters({ ...ok, dip: '' }).ok).toBe(false);
    expect(parseKinematicParameters({ ...ok, dip: 'abc' }).ok).toBe(false);
    expect(parseKinematicParameters({ ...ok, dipDirection: '361' }).ok).toBe(false);
    expect(parseKinematicParameters({ ...ok, dipDirection: '-1' }).ok).toBe(false);
    expect(parseKinematicParameters({ ...ok, dip: '91' }).ok).toBe(false);
    expect(parseKinematicParameters({ ...ok, friction: '90' }).ok).toBe(false);
    expect(parseKinematicParameters({ ...ok, friction: '-5' }).ok).toBe(false);
    expect(parseKinematicParameters({ ...ok, friction: 'Infinity' }).ok).toBe(false);
  });

  it('names the offending parameter in the message', () => {
    const result = parseKinematicParameters({ ...ok, friction: '95' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('Friction');
  });
});

describe('updateParameterState', () => {
  it('stores valid edits and clears the error', () => {
    const next = updateParameterState(DEFAULT_PARAMETER_STATE, 'dip', '70');
    expect(next.error).toBeNull();
    expect(next.valid.slope.dip).toBe(70);
    expect(next.raw.dip).toBe('70');
  });

  it('keeps the last valid parameters while invalid text is being typed', () => {
    const next = updateParameterState(DEFAULT_PARAMETER_STATE, 'friction', '9x');
    expect(next.error).not.toBeNull();
    expect(next.raw.friction).toBe('9x');
    expect(next.valid).toEqual(DEFAULT_PARAMETER_STATE.valid);
  });

  it('recovers when the text becomes valid again', () => {
    const bad = updateParameterState(DEFAULT_PARAMETER_STATE, 'friction', '');
    const good = updateParameterState(bad, 'friction', '25');
    expect(good.error).toBeNull();
    expect(good.valid.frictionAngle).toBe(25);
  });
});

describe('analyzePlane — planar sliding (slope 60°/130°, φ = 30°)', () => {
  it('Plane A 127/45 is admissible with positive margins and no reasons', () => {
    const a = analyzePlane('planarSliding', PARAMS, { dipDirection: 127, dip: 45 });
    expect(a.status).toBe('admissible');
    expect(field(a.fields, 'Planar sliding')).toBe('Admissible');
    expect(field(a.fields, 'Reasons')).toBeUndefined();
    expect(field(a.fields, 'Daylight margin')).toBe('+15.0°');
    expect(field(a.fields, 'Friction margin')).toBe('+15.0°');
  });

  it('Plane B 230/62 is rejected for daylight and dip direction, with a true minus sign', () => {
    const b = analyzePlane('planarSliding', PARAMS, { dipDirection: 230, dip: 62 });
    expect(b.status).toBe('rejected');
    expect(field(b.fields, 'Planar sliding')).toBe('Rejected');
    expect(field(b.fields, 'Reasons')).toContain(REJECTION_LABELS.daylightConditionFailed);
    expect(field(b.fields, 'Reasons')).toContain(REJECTION_LABELS.azimuthSectorFailed);
    expect(field(b.fields, 'Daylight margin')).toBe('−2.0°');
  });

  it('Plane C 045/30 is rejected for friction because dip equals φ (strict inequality)', () => {
    const c = analyzePlane('planarSliding', PARAMS, { dipDirection: 45, dip: 30 });
    expect(c.status).toBe('rejected');
    expect(field(c.fields, 'Reasons')).toContain(REJECTION_LABELS.frictionConditionFailed);
    expect(field(c.fields, 'Friction margin')).toBe('0.0°');
  });

  it('a dip direction exactly at the sector edge (20°) is rejected', () => {
    const f = analyzePlane('planarSliding', PARAMS, { dipDirection: 150, dip: 45 });
    expect(f.status).toBe('rejected');
    expect(field(f.fields, 'Reasons')).toBe(REJECTION_LABELS.azimuthSectorFailed);
  });

  it('always carries the not-a-factor-of-safety note', () => {
    const a = analyzePlane('planarSliding', PARAMS, { dipDirection: 127, dip: 45 });
    expect(field(a.fields, 'Note')).toContain('Not a factor of safety');
  });
});

describe('analyzePlane — direct toppling (slope 60°/130°, φ = 30°)', () => {
  it('a steep plane dipping into the slope (310/75) is admissible', () => {
    const d = analyzePlane('directToppling', PARAMS, { dipDirection: 310, dip: 75 });
    expect(d.status).toBe('admissible');
    expect(field(d.fields, 'Direct toppling')).toBe('Admissible');
    expect(field(d.fields, 'Steepness margin')).toBe('+15.0°');
  });

  it('a plane dipping with the slope (127/45) is rejected', () => {
    const a = analyzePlane('directToppling', PARAMS, { dipDirection: 127, dip: 45 });
    expect(a.status).toBe('rejected');
    expect(field(a.fields, 'Reasons')).toContain(REJECTION_LABELS.azimuthSectorFailed);
  });
});

describe('buildOverlayLayers', () => {
  it('returns one admissible-zone region and only dashed curves for planar sliding', () => {
    const layers = buildOverlayLayers('planarSliding', PARAMS);
    expect(layers.regions).toHaveLength(1);
    expect(layers.regions[0]!.rings).toHaveLength(1);
    expect(layers.curves.length).toBeGreaterThan(0);
    expect(layers.curves.every((c) => c.dashed)).toBe(true);
    expect(new Set(layers.curves.map((c) => c.id)).size).toBe(layers.curves.length);
  });

  it('returns no region when no orientation can be admissible (ψf ≤ φ)', () => {
    const layers = buildOverlayLayers('planarSliding', {
      slope: { dipDirection: 0, dip: 20 },
      frictionAngle: 30,
    });
    expect(layers.regions).toEqual([]);
  });

  it('returns a toppling zone region for the default parameters', () => {
    expect(buildOverlayLayers('directToppling', PARAMS).regions).toHaveLength(1);
  });
});
