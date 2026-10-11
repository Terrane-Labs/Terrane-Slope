import React from 'react';
import type { StereonetCursor } from './stereonet-types';

export interface CursorDisplayProps {
  /**
   * The current stereonet cursor position, or `null` when the pointer is
   * outside the stereonet boundary.
   */
  cursor: StereonetCursor | null;
}

/**
 * Displays the geological orientation (trend / plunge) of the current
 * stereonet cursor position.
 *
 * Renders a stable placeholder when the cursor is null (pointer outside the
 * stereonet). Performs no calculation — `trend` and `plunge` are pre-computed
 * by the Stereonet component via `@terrane-labs/geometry`.
 */
export function CursorDisplay({ cursor }: CursorDisplayProps): React.ReactElement {
  const content =
    cursor === null ? (
      <span data-testid="cursor-placeholder" style={{ color: '#999' }}>
        —
      </span>
    ) : (
      <span data-testid="cursor-value" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {cursor.trend.toFixed(1)}° / {cursor.plunge.toFixed(1)}°
      </span>
    );

  return (
    <div
      aria-label="Cursor position"
      style={{
        padding: '8px 16px',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        color: '#333',
      }}
    >
      <span style={{ color: '#555', marginRight: 6 }}>Cursor:</span>
      {content}
    </div>
  );
}
