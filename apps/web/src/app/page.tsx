'use client';

import React, { useMemo, useState } from 'react';
import { projectPlanePole, projectPlaneGreatCircle, projectLine } from '@terrane-labs/geometry';
import type { PlaneOrientation, LineOrientation } from '@terrane-labs/domain';
import { Stereonet, StereonetInspectorPanel, CursorDisplay } from '@terrane-labs/ui';
import type {
  StereonetCursor,
  StereonetFeature,
  StereonetGreatCircle,
  StereonetLineation,
  StereonetPole,
  StereonetSelection,
  InspectorEntry,
  InspectorField,
} from '@terrane-labs/ui';
import { RenderingShell } from '../components/rendering-shell';
import { KinematicControls } from '../components/kinematic-controls';
import type { AnalysisMode } from '../components/kinematic-controls';
import {
  DEFAULT_PARAMETER_STATE,
  analyzePlane,
  buildOverlayLayers,
  updateParameterState,
} from '../lib/kinematic-view-model';
import type { ParameterInputs, ParameterState, PlaneAnalysis } from '../lib/kinematic-view-model';

// ── Fixture data ──────────────────────────────────────────────────────────────
// Raw geological records. IDs are stable string keys shared with the projected
// arrays below. Formatting of display values is done in `buildInspectorEntry`.

const PLANE_FIXTURES: ReadonlyArray<PlaneOrientation & { id: string; label: string }> = [
  { id: 'plane-0', label: 'Plane A', dipDirection: 127, dip: 45 },
  { id: 'plane-1', label: 'Plane B', dipDirection: 230, dip: 62 },
  { id: 'plane-2', label: 'Plane C', dipDirection: 45, dip: 30 },
  // Added for the kinematic overlays (default slope 60°/130°, φ = 30°):
  //   D dips into the slope and is steep → admissible for direct toppling.
  //   E is admissible for planar sliding with a wide margin.
  //   F sits exactly on the 20° dip-direction sector edge → rejected (strict inequality).
  { id: 'plane-3', label: 'Plane D', dipDirection: 310, dip: 75 },
  { id: 'plane-4', label: 'Plane E', dipDirection: 135, dip: 40 },
  { id: 'plane-5', label: 'Plane F', dipDirection: 150, dip: 45 },
];

const LINE_FIXTURES: ReadonlyArray<LineOrientation & { id: string; label: string }> = [
  { id: 'line-0', label: 'Lineation α', trend: 185, plunge: 22 },
  { id: 'line-1', label: 'Lineation β', trend: 310, plunge: 55 },
];

// ── Pre-projected arrays (module-level constants) ─────────────────────────────

const POLES: StereonetPole[] = PLANE_FIXTURES.map((p) => ({
  id: p.id,
  point: projectPlanePole({ dipDirection: p.dipDirection, dip: p.dip }),
}));

const GREAT_CIRCLES: StereonetGreatCircle[] = PLANE_FIXTURES.map((p) => ({
  id: `gc-${p.id}`,
  points: [...projectPlaneGreatCircle({ dipDirection: p.dipDirection, dip: p.dip })],
}));

const LINEATIONS: StereonetLineation[] = LINE_FIXTURES.map((l) => ({
  id: l.id,
  point: projectLine({ trend: l.trend, plunge: l.plunge }),
}));

// ── ID → geological record lookup ────────────────────────────────────────────

function buildInspectorEntry(
  feature: StereonetFeature,
  analyses: ReadonlyMap<string, PlaneAnalysis> | null,
): InspectorEntry | null {
  const analysisFields = (planeId: string): ReadonlyArray<InspectorField> =>
    analyses?.get(planeId)?.fields ?? [];

  if (feature.type === 'pole') {
    const record = PLANE_FIXTURES.find((p) => p.id === feature.id);
    if (!record) return null;
    return {
      label: `Plane pole — ${record.label}`,
      id: record.id,
      fields: [
        { name: 'Dip direction', value: `${record.dipDirection}°` },
        { name: 'Dip', value: `${record.dip}°` },
        ...analysisFields(record.id),
      ],
    };
  }

  if (feature.type === 'greatCircle') {
    // Great-circle IDs are prefixed with 'gc-' over the corresponding plane id.
    const planeId = feature.id.replace(/^gc-/, '');
    const record = PLANE_FIXTURES.find((p) => p.id === planeId);
    if (!record) return null;
    return {
      label: `Great circle — ${record.label}`,
      id: feature.id,
      fields: [
        { name: 'Dip direction', value: `${record.dipDirection}°` },
        { name: 'Dip', value: `${record.dip}°` },
        ...analysisFields(record.id),
      ],
    };
  }

  if (feature.type === 'lineation') {
    const record = LINE_FIXTURES.find((l) => l.id === feature.id);
    if (!record) return null;
    return {
      label: `Lineation — ${record.label}`,
      id: record.id,
      fields: [
        { name: 'Trend', value: `${record.trend}°` },
        { name: 'Plunge', value: `${record.plunge}°` },
      ],
    };
  }

  return null;
}

// ── Workspace page ────────────────────────────────────────────────────────────

export default function HomePage() {
  const [selection, setSelection] = useState<StereonetSelection | null>(null);
  const [cursor, setCursor] = useState<StereonetCursor | null>(null);
  const [hover, setHover] = useState<StereonetFeature | null>(null);
  const [mode, setMode] = useState<AnalysisMode>('planarSliding');
  const [parameters, setParameters] = useState<ParameterState>(DEFAULT_PARAMETER_STATE);

  const handleParameterChange = (field: keyof ParameterInputs, value: string) => {
    setParameters((previous) => updateParameterState(previous, field, value));
  };

  // Verdicts come from the kinematic evaluators; overlays are drawn aids only.
  const analyses = useMemo<ReadonlyMap<string, PlaneAnalysis> | null>(() => {
    if (mode === 'off') return null;
    return new Map(
      PLANE_FIXTURES.map((p) => [
        p.id,
        analyzePlane(mode, parameters.valid, { dipDirection: p.dipDirection, dip: p.dip }),
      ]),
    );
  }, [mode, parameters.valid]);

  const overlay = useMemo(
    () => (mode === 'off' ? null : buildOverlayLayers(mode, parameters.valid)),
    [mode, parameters.valid],
  );

  const poles = useMemo<StereonetPole[]>(
    () =>
      POLES.map((pole) => {
        const analysis = analyses?.get(pole.id);
        return analysis === undefined ? pole : { ...pole, status: analysis.status };
      }),
    [analyses],
  );

  const entry = selection !== null ? buildInspectorEntry(selection, analyses) : null;

  const handleSelectionChange = (next: StereonetSelection | null) => {
    // Toggle: clicking the same feature deselects it.
    if (
      next !== null &&
      selection !== null &&
      next.type === selection.type &&
      next.id === selection.id
    ) {
      setSelection(null);
    } else {
      setSelection(next);
    }
  };

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ padding: '16px 20px', margin: 0, fontSize: 18, color: '#222' }}>
        Terrane Slope
      </h1>
      <p style={{ margin: '0 20px 12px', fontSize: 13, color: '#666' }}>
        Phase 2A.3 — Planar and toppling kinematic zones
      </p>

      <div
        style={{
          display: 'flex',
          gap: 0,
          border: '1px solid #ddd',
          borderRadius: 6,
          overflow: 'hidden',
          margin: '0 20px 20px',
          maxWidth: 780,
        }}
      >
        {/* Left panel — stereonet */}
        <div
          style={{
            flex: '0 0 auto',
            borderRight: '1px solid #ddd',
            background: '#fff',
          }}
        >
          <Stereonet
            size={400}
            poles={poles}
            greatCircles={mode === 'off' ? GREAT_CIRCLES : []}
            lineations={LINEATIONS}
            overlayRegions={overlay?.regions}
            overlayCurves={overlay?.curves}
            selection={selection}
            onSelectionChange={handleSelectionChange}
            onHover={setHover}
            onCursorMove={setCursor}
          />
        </div>

        {/* Right panel — controls + cursor + inspector */}
        <div
          style={{
            flex: '1 1 0',
            minWidth: 200,
            display: 'flex',
            flexDirection: 'column',
            background: '#fafafa',
          }}
        >
          {/* Kinematic analysis controls */}
          <div style={{ borderBottom: '1px solid #eee', background: '#fff' }}>
            <KinematicControls
              mode={mode}
              onModeChange={setMode}
              inputs={parameters.raw}
              onInputChange={handleParameterChange}
              error={parameters.error}
            />
          </div>

          {/* Cursor telemetry row */}
          <div
            style={{
              borderBottom: '1px solid #eee',
              padding: '6px 0',
              background: '#fff',
            }}
          >
            <CursorDisplay cursor={cursor} />
          </div>

          {/* Hover hint row */}
          <div
            style={{
              borderBottom: '1px solid #eee',
              padding: '6px 16px',
              fontSize: 12,
              color: '#888',
              minHeight: 28,
            }}
          >
            {hover !== null ? `Hovering: ${hover.type} ${hover.id}` : ''}
          </div>

          {/* Inspector */}
          <StereonetInspectorPanel entry={entry} />
        </div>
      </div>

      {/* 3D Rendering shell */}
      <section style={{ margin: '0 20px' }}>
        <RenderingShell />
      </section>
    </main>
  );
}
