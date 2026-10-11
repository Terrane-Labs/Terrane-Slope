/**
 * Azimuth sector constants shared by the evaluators and the stereonet overlays.
 * A single definition guarantees that a drawn zone and an evaluator verdict use
 * the same lateral limit.
 */

/** Default half-width (degrees) of the planar sliding dip-direction sector (Hoek & Bray). */
export const DEFAULT_PLANAR_AZIMUTH_SECTOR_DEG = 20;

/** Half-width (degrees) of the direct toppling dip-direction sector used by `evaluateDirectToppling`. */
export const DIRECT_TOPPLING_AZIMUTH_SECTOR_DEG = 20;
