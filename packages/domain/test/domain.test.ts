import { describe, expectTypeOf, it } from 'vitest';
import type {
  Degrees,
  DirectTopplingResult,
  FrictionAngle,
  KinematicMode,
  KinematicRejectionReason,
  KinematicResultBase,
  LineOrientation,
  Metres,
  PlaneOrientation,
  PlanarSlidingResult,
  Radians,
  SlopeFace,
  Vector3,
  WedgeSlidingResult,
} from '../src';

describe('domain coordinate and orientation contract', () => {
  it('keeps scalar units lightweight aliases', () => {
    expectTypeOf<Degrees>().toEqualTypeOf<number>();
    expectTypeOf<Radians>().toEqualTypeOf<number>();
    expectTypeOf<Metres>().toEqualTypeOf<number>();
    expectTypeOf<FrictionAngle>().toEqualTypeOf<number>();
  });

  it('uses one minimal Cartesian tuple for directions and normals', () => {
    expectTypeOf<Vector3>().toMatchTypeOf<{ x: number; y: number; z: number }>();
    expectTypeOf<PlaneOrientation>().toMatchTypeOf<{ dipDirection: number; dip: number }>();
    expectTypeOf<SlopeFace>().toMatchTypeOf<{ dipDirection: number; dip: number }>();
  });
});

describe('kinematic analysis type contract', () => {
  it('KinematicMode is a union of three string literals', () => {
    expectTypeOf<KinematicMode>().toEqualTypeOf<
      'planarSliding' | 'wedgeSliding' | 'directToppling'
    >();
  });

  it('KinematicRejectionReason is a union of string literals', () => {
    // KinematicRejectionReason is a string-union; verify each known member is assignable to it
    expectTypeOf<'noIntersectionLine'>().toMatchTypeOf<KinematicRejectionReason>();
    expectTypeOf<'daylightConditionFailed'>().toMatchTypeOf<KinematicRejectionReason>();
    expectTypeOf<'horizontalSlope'>().toMatchTypeOf<KinematicRejectionReason>();
  });

  it('KinematicResultBase has expected shape', () => {
    expectTypeOf<KinematicResultBase>().toMatchTypeOf<{
      mode: KinematicMode;
      isAdmissible: boolean;
      rejectionReasons: readonly KinematicRejectionReason[];
    }>();
  });

  it('PlanarSlidingResult extends base and has margin angles', () => {
    expectTypeOf<PlanarSlidingResult>().toMatchTypeOf<KinematicResultBase>();
    expectTypeOf<PlanarSlidingResult>().toMatchTypeOf<{
      mode: 'planarSliding';
      daylightExcess: number;
      frictionExcess: number;
    }>();
  });

  it('WedgeSlidingResult extends base and has intersection line', () => {
    expectTypeOf<WedgeSlidingResult>().toMatchTypeOf<KinematicResultBase>();
    expectTypeOf<WedgeSlidingResult>().toMatchTypeOf<{
      mode: 'wedgeSliding';
      intersectionLine: LineOrientation | null;
      daylightExcess: number | null;
      frictionExcess: number | null;
    }>();
  });

  it('DirectTopplingResult extends base and has dipExcess', () => {
    expectTypeOf<DirectTopplingResult>().toMatchTypeOf<KinematicResultBase>();
    expectTypeOf<DirectTopplingResult>().toMatchTypeOf<{
      mode: 'directToppling';
      dipExcess: number;
    }>();
  });
});
