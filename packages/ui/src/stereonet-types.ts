import type { StereonetPoint } from '@terrane-labs/domain';

// ── Feature representations ─────────────────────────────────────────────────

/**
 * Semantic classification of a plotted feature, supplied by the caller.
 * The UI renders it with a non-hue-only encoding (fill and outline) and does not
 * compute it.
 */
export type StereonetStatus = 'admissible' | 'rejected';

/**
 * A plane pole to display on the stereonet.
 * The `id` uniquely identifies the feature for selection and hover callbacks.
 * The `point` is the pre-projected stereonet coordinate produced by
 * \`@terrane-labs/geometry\`.
 * The optional `status` marks the pole as admissible or rejected under the active
 * analysis. When absent, the pole uses the neutral marker style.
 */
export interface StereonetPole {
  id: string;
  point: StereonetPoint;
  status?: StereonetStatus;
}

/**
 * A lineation to display on the stereonet.
 * The `id` uniquely identifies the feature for selection and hover callbacks.
 * The `point` is the pre-projected stereonet coordinate produced by
 * \`@terrane-labs/geometry\`.
 */
export interface StereonetLineation {
  id: string;
  point: StereonetPoint;
}

/**
 * A great-circle trace to display on the stereonet.
 * The `id` uniquely identifies the feature for selection and hover callbacks.
 * The `points` are an ordered array of pre-projected stereonet coordinates
 * produced by \`@terrane-labs/geometry\`.
 */
export interface StereonetGreatCircle {
  id: string;
  points: StereonetPoint[];
}

// ── Overlays ────────────────────────────────────────────────────────────────

/**
 * A filled region drawn beneath the stereonet features, such as an admissible zone.
 * `rings` are closed outlines in stereonet coordinates without a repeated closing
 * point, filled with the even-odd rule. `label` is a human-readable name used for
 * the accessible title. Overlays do not take part in hit-testing or selection.
 */
export interface StereonetOverlayRegion {
  id: string;
  label: string;
  rings: ReadonlyArray<ReadonlyArray<StereonetPoint>>;
}

/**
 * A boundary curve drawn beneath the stereonet features.
 * `dashed` marks a boundary that is excluded from the region it bounds.
 * Overlays do not take part in hit-testing or selection.
 */
export interface StereonetOverlayCurve {
  id: string;
  label: string;
  points: ReadonlyArray<StereonetPoint>;
  dashed: boolean;
}

// ── Unified feature type ────────────────────────────────────────────────────

/**
 * A discriminated union identifying any single stereonet feature.
 * Feature identity is based on explicit stable IDs, not array indexes.
 *
 * Used as the value type for selection and hover callbacks.
 */
export type StereonetFeature =
  | { type: 'pole'; id: string }
  | { type: 'lineation'; id: string }
  | { type: 'greatCircle'; id: string };

// ── Selection ───────────────────────────────────────────────────────────────

/**
 * The currently selected stereonet feature.
 *
 * Represents a single selected feature. `null` means no selection.
 * Multi-selection is not supported.
 *
 * Controlled selection semantics:
 *
 * - Selecting an unselected feature:  null → feature A
 * - Selecting a different feature:    feature A → feature B
 * - Deselecting the current feature:  feature A → null
 *   (deselect behavior is implemented by the pointer interaction layer,
 *    not by this type definition.)
 */
export type StereonetSelection = StereonetFeature;

// ── Cursor information ──────────────────────────────────────────────────────

/**
 * The geological position of the pointer on the stereonet.
 *
 * `x` and `y` are normalized stereonet coordinates (unit disk, x-East,
 * y-North), produced by the inverse display transform from the SVG pointer
 * position.
 *
 * `trend` and `plunge` are the geological orientation corresponding to that
 * position, derived via the inverse Wulff projection implemented in
 * \`@terrane-labs/geometry\`. The UI layer does not perform this calculation.
 *
 * `null` is emitted when the pointer leaves the stereonet boundary.
 */
export interface StereonetCursor {
  /** Normalized stereonet x-coordinate (East positive, range [-1, 1]). */
  x: number;
  /** Normalized stereonet y-coordinate (North positive, range [-1, 1]). */
  y: number;
  /** Geological trend in decimal degrees, clockwise from North [0°, 360°). */
  trend: number;
  /** Geological plunge in decimal degrees, downward from horizontal [0°, 90°]. */
  plunge: number;
}
