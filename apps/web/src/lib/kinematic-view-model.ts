/**
 * Presentation view-model for the kinematic stereonet overlays.
 *
 * This module maps domain results from `@geokinematics/kinematics` to display
 * vocabulary (labels, pole status, inspector fields, overlay layers). It performs
 * no scientific computation: admissibility comes from the evaluators and zone
 * geometry from the overlay builders. Parsing and range checks of user input are
 * input validation, not geology; the authoritative range checks remain in the
 * overlay builder, which throws `RangeError`.
 */

import type { KinematicRejectionReason, PlaneOrientation, SlopeFace } from '@geokinematics/domain';
import {
  buildKinematicOverlay,
  evaluateDirectToppling,
  evaluatePlanarSliding,
  type KinematicOverlayMode,
  type KinematicOverlayRole,
} from '@geokinematics/kinematics';
import type {
  InspectorField,
  StereonetOverlayCurve,
  StereonetOverlayRegion,
  StereonetStatus,
} from '@geokinematics/ui';

// ── Labels ────────────────────────────────────────────────────────────────────

export const MODE_LABELS: Readonly<Record<KinematicOverlayMode, string>> = {
  planarSliding: 'Planar sliding',
  directToppling: 'Direct toppling',
};

/**
 * Exhaustive over `KinematicRejectionReason`: adding a reason to the domain package
 * fails typecheck here until a label exists.
 */
export const REJECTION_LABELS: Readonly<Record<KinematicRejectionReason, string>> = {
  noIntersectionLine: 'Planes are parallel (no intersection line)',
  daylightConditionFailed: 'Daylight condition not satisfied',
  frictionConditionFailed: 'Friction/steepness condition not satisfied',
  azimuthSectorFailed: 'Dip direction outside the admissible sector',
  horizontalPlane: 'Plane is horizontal',
  horizontalSlope: 'Slope face is horizontal',
};

const ROLE_LABELS: Readonly<Record<KinematicOverlayRole, string>> = {
  daylightEnvelope: 'Daylight envelope (plane dip = slope dip)',
  frictionCone: 'Friction cone (plane dip = friction angle)',
  topplingLimit: 'Toppling limit (plane dip = 90° − slope dip + friction angle)',
  lateralLimit: 'Dip-direction sector limit',
};

// ── Parameters ────────────────────────────────────────────────────────────────

export interface KinematicParameters {
  readonly slope: SlopeFace;
  readonly frictionAngle: number;
}

/** Raw text of the three parameter inputs. */
export interface ParameterInputs {
  readonly dipDirection: string;
  readonly dip: string;
  readonly friction: string;
}

export type ParseResult =
  | { readonly ok: true; readonly value: KinematicParameters }
  | { readonly ok: false; readonly message: string };

function parseNumber(text: string): number {
  return text.trim() === '' ? NaN : Number(text);
}

/**
 * Parses the raw inputs. Ranges follow the domain contract: dip direction in
 * [0°, 360°], slope dip in [0°, 90°], friction angle in [0°, 90°).
 */
export function parseKinematicParameters(inputs: ParameterInputs): ParseResult {
  const dipDirection = parseNumber(inputs.dipDirection);
  const dip = parseNumber(inputs.dip);
  const friction = parseNumber(inputs.friction);

  if (!Number.isFinite(dipDirection) || dipDirection < 0 || dipDirection > 360) {
    return { ok: false, message: 'Slope dip direction must be a number from 0° to 360°.' };
  }
  if (!Number.isFinite(dip) || dip < 0 || dip > 90) {
    return { ok: false, message: 'Slope dip must be a number from 0° to 90°.' };
  }
  if (!Number.isFinite(friction) || friction < 0 || friction >= 90) {
    return { ok: false, message: 'Friction angle must be at least 0° and less than 90°.' };
  }
  return { ok: true, value: { slope: { dipDirection, dip }, frictionAngle: friction } };
}

export interface ParameterState {
  readonly raw: ParameterInputs;
  /** Last parameters that passed validation. Analysis always uses these. */
  readonly valid: KinematicParameters;
  /** Message for the current raw inputs, or `null` when they are valid. */
  readonly error: string | null;
}

export const DEFAULT_PARAMETER_STATE: ParameterState = {
  raw: { dipDirection: '130', dip: '60', friction: '30' },
  valid: { slope: { dipDirection: 130, dip: 60 }, frictionAngle: 30 },
  error: null,
};

/**
 * Applies one edited input. Invalid text is kept in `raw` (so the user can keep
 * typing) while `valid` keeps the last good parameters.
 */
export function updateParameterState(
  previous: ParameterState,
  field: keyof ParameterInputs,
  value: string,
): ParameterState {
  const raw: ParameterInputs = { ...previous.raw, [field]: value };
  const parsed = parseKinematicParameters(raw);
  return parsed.ok
    ? { raw, valid: parsed.value, error: null }
    : { raw, valid: previous.valid, error: parsed.message };
}

// ── Per-plane analysis ────────────────────────────────────────────────────────

export interface PlaneAnalysis {
  readonly status: StereonetStatus;
  /** Inspector fields describing the verdict, reasons, and angular margins. */
  readonly fields: ReadonlyArray<InspectorField>;
}

/** Formats an angle with an explicit sign and a true minus. Values that round to zero carry no sign. */
function formatSignedDegrees(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return '0.0°';
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(1)}°`;
}

function verdictFields(
  mode: KinematicOverlayMode,
  isAdmissible: boolean,
  reasons: ReadonlyArray<KinematicRejectionReason>,
  margins: ReadonlyArray<InspectorField>,
): InspectorField[] {
  const fields: InspectorField[] = [
    { name: MODE_LABELS[mode], value: isAdmissible ? 'Admissible' : 'Rejected' },
  ];
  if (!isAdmissible) {
    fields.push({
      name: 'Reasons',
      value: reasons.map((reason) => REJECTION_LABELS[reason]).join('; '),
    });
  }
  fields.push(...margins, {
    name: 'Note',
    value: 'Angular margins; positive satisfies the condition. Not a factor of safety.',
  });
  return fields;
}

/**
 * Evaluates one plane under the active mode. Status and reasons come only from
 * the kinematic evaluators.
 *
 * @throws {RangeError} if the evaluator rejects non-finite input.
 */
export function analyzePlane(
  mode: KinematicOverlayMode,
  parameters: KinematicParameters,
  plane: PlaneOrientation,
): PlaneAnalysis {
  const { slope, frictionAngle } = parameters;

  if (mode === 'planarSliding') {
    const result = evaluatePlanarSliding(slope, plane, frictionAngle);
    return {
      status: result.isAdmissible ? 'admissible' : 'rejected',
      fields: verdictFields(mode, result.isAdmissible, result.rejectionReasons, [
        { name: 'Daylight margin', value: formatSignedDegrees(result.daylightExcess) },
        { name: 'Friction margin', value: formatSignedDegrees(result.frictionExcess) },
      ]),
    };
  }

  const result = evaluateDirectToppling(slope, plane, frictionAngle);
  return {
    status: result.isAdmissible ? 'admissible' : 'rejected',
    fields: verdictFields(mode, result.isAdmissible, result.rejectionReasons, [
      { name: 'Steepness margin', value: formatSignedDegrees(result.dipExcess) },
    ]),
  };
}

// ── Overlay layers ────────────────────────────────────────────────────────────

export interface OverlayLayers {
  readonly regions: StereonetOverlayRegion[];
  readonly curves: StereonetOverlayCurve[];
}

/**
 * Builds the UI overlay layers for the active mode. All boundary curves are dashed
 * because every boundary except the toppling rim is an exclusive (strict-inequality)
 * limit.
 *
 * @throws {RangeError} for parameters outside the overlay builder's contract.
 */
export function buildOverlayLayers(
  mode: KinematicOverlayMode,
  parameters: KinematicParameters,
): OverlayLayers {
  const overlay = buildKinematicOverlay(mode, parameters.slope, parameters.frictionAngle);
  const regions: StereonetOverlayRegion[] =
    overlay.zone.rings.length > 0
      ? [
          {
            id: 'overlay-zone',
            label: `${MODE_LABELS[mode]} — admissible zone for plane poles`,
            rings: overlay.zone.rings,
          },
        ]
      : [];
  const curves: StereonetOverlayCurve[] = overlay.curves.map((curve, index) => ({
    id: `overlay-${curve.role}-${index}`,
    label: ROLE_LABELS[curve.role],
    points: curve.points,
    dashed: true,
  }));
  return { regions, curves };
}
