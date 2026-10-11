'use client';

import React from 'react';
import type { KinematicOverlayMode } from '@terrane-labs/kinematics';
import type { ParameterInputs } from '../lib/kinematic-view-model';
import { MODE_LABELS } from '../lib/kinematic-view-model';

export type AnalysisMode = 'off' | KinematicOverlayMode;

export interface KinematicControlsProps {
  mode: AnalysisMode;
  onModeChange: (mode: AnalysisMode) => void;
  inputs: ParameterInputs;
  onInputChange: (field: keyof ParameterInputs, value: string) => void;
  /** Validation message for the current inputs, or `null`. */
  error: string | null;
}

const MODE_OPTIONS: ReadonlyArray<{ value: AnalysisMode; label: string }> = [
  { value: 'off', label: 'Off' },
  { value: 'planarSliding', label: MODE_LABELS.planarSliding },
  { value: 'directToppling', label: MODE_LABELS.directToppling },
];

const FIELDS: ReadonlyArray<{ field: keyof ParameterInputs; label: string }> = [
  { field: 'dipDirection', label: 'Slope dip direction (°)' },
  { field: 'dip', label: 'Slope dip (°)' },
  { field: 'friction', label: 'Friction angle (°)' },
];

/**
 * Presentation-only controls for the kinematic overlay: mode selection and the
 * three input parameters. Holds no state and performs no calculation.
 */
export function KinematicControls({
  mode,
  onModeChange,
  inputs,
  onInputChange,
  error,
}: KinematicControlsProps): React.ReactElement {
  return (
    <section
      aria-label="Kinematic analysis controls"
      style={{ padding: '10px 16px', fontSize: 13, color: '#222' }}
    >
      <fieldset style={{ border: 'none', margin: '0 0 8px', padding: 0 }}>
        <legend style={{ fontWeight: 600, padding: 0, marginBottom: 4 }}>Kinematic analysis</legend>
        {MODE_OPTIONS.map((option) => (
          <label key={option.value} style={{ display: 'block', marginBottom: 2 }}>
            <input
              type="radio"
              name="analysis-mode"
              value={option.value}
              checked={mode === option.value}
              onChange={() => onModeChange(option.value)}
              style={{ marginRight: 6 }}
            />
            {option.label}
          </label>
        ))}
      </fieldset>

      {mode !== 'off' && (
        <div>
          {FIELDS.map(({ field, label }) => (
            <label
              key={field}
              style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}
            >
              <span>{label}</span>
              <input
                type="text"
                inputMode="decimal"
                value={inputs[field]}
                onChange={(e) => onInputChange(field, e.target.value)}
                aria-invalid={error !== null}
                style={{ width: 64, textAlign: 'right' }}
              />
            </label>
          ))}
          {error !== null && (
            <p role="alert" style={{ margin: '6px 0 0', color: '#b91c1c', fontSize: 12 }}>
              {error} Showing the last valid parameters.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
