import type { Degrees } from '@terrane-labs/domain';

/** Numerical tolerance used by deterministic normal canonicalization. */
export const CANONICAL_EPSILON = 1e-12;

/**
 * Angular tolerance in decimal degrees used for kinematic boundary classification.
 * Prevents numerical noise near boundaries from producing indeterminate classifications.
 */
export const KINEMATIC_ANGULAR_TOLERANCE: Degrees = 1e-6;
