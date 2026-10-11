import React from 'react';
import type { StereonetPoint } from '@geokinematics/domain';
import { unprojectLine } from '@geokinematics/geometry';
import type {
  StereonetCursor,
  StereonetFeature,
  StereonetGreatCircle,
  StereonetLineation,
  StereonetOverlayCurve,
  StereonetOverlayRegion,
  StereonetPole,
  StereonetSelection,
} from './stereonet-types';

export interface StereonetProps {
  /** SVG canvas size in pixels. Defaults to 400. */
  size?: number;
  /**
   * Interval in degrees between Wulff grid lines.
   * Must be a divisor of 90. Defaults to 10.
   */
  gridInterval?: number;
  /** Whether to render the Wulff/equal-angle grid. Defaults to true. */
  showGrid?: boolean;
  /** Whether to render the N/E/S/W cardinal and degree labels. Defaults to true. */
  showLabels?: boolean;
  /** Pre-projected lineation features to plot as filled circles. */
  lineations?: StereonetLineation[];
  /** Pre-projected pole features to plot as filled squares. */
  poles?: StereonetPole[];
  /**
   * Pre-projected great-circle features. Each entry carries a stable id and
   * an ordered array of StereonetPoint values defining one great-circle trace.
   */
  greatCircles?: StereonetGreatCircle[];
  /**
   * Pre-projected filled regions drawn beneath all features (for example an
   * admissible zone). Not interactive.
   */
  overlayRegions?: ReadonlyArray<StereonetOverlayRegion>;
  /**
   * Pre-projected boundary curves drawn beneath all features. Not interactive.
   */
  overlayCurves?: ReadonlyArray<StereonetOverlayCurve>;

  // ── Interaction contract ────────────────────────────────────────────────

  /**
   * The currently selected feature, or `null` for no selection.
   * Controlled prop — the parent is responsible for state management.
   */
  selection?: StereonetSelection | null;

  /**
   * Called when the user selects or deselects a feature.
   * Receives the newly selected feature, or `null` when deselected.
   */
  onSelectionChange?: (selection: StereonetSelection | null) => void;

  /**
   * Called when the pointer enters or leaves a feature.
   * Receives the hovered feature, or `null` when leaving a feature.
   */
  onHover?: (feature: StereonetFeature | null) => void;

  /**
   * Called as the pointer moves across the stereonet surface.
   * Receives the current normalized stereonet coordinate and its geological
   * orientation (via inverse Wulff projection in `@geokinematics/geometry`),
   * or `null` when the pointer leaves the stereonet boundary.
   */
  onCursorMove?: (cursor: StereonetCursor | null) => void;
}

// ── Interaction constants ───────────────────────────────────────────────────

/** Interaction hit-testing radius in SVG units for point features (poles/lineations). */
export const POINT_HIT_RADIUS_SVG = 8;

/** Interaction hit-testing radius in SVG units for great-circle paths. */
export const GREAT_CIRCLE_HIT_RADIUS_SVG = 6;

// ── Marker and overlay styles ───────────────────────────────────────────────

interface PoleStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
}

/** Neutral pole marker, used when no status is supplied. */
const NEUTRAL_POLE_STYLE: PoleStyle = { fill: '#15803d', stroke: '#fff', strokeWidth: 0.75 };

/**
 * Status styles. Admissible poles are filled with a heavy dark outline; rejected
 * poles are hollow with a thin grey outline. The fill/hollow difference carries the
 * status for viewers who cannot distinguish the hues.
 */
const POLE_STATUS_STYLE: Record<'admissible' | 'rejected', PoleStyle> = {
  admissible: { fill: '#009e73', stroke: '#064e3b', strokeWidth: 1.75 },
  rejected: { fill: '#ffffff', stroke: '#6b7280', strokeWidth: 1.25 },
};

const OVERLAY_ADMISSIBLE_FILL = 'rgba(0, 158, 115, 0.18)';
const OVERLAY_BOUNDARY_STROKE = '#0f766e';

/**
 * Applies the visualization-only linear transform from stereonet coordinates
 * (unit disk, x-East, y-North) to SVG pixel coordinates.
 *
 * svgX = center + stereonetX * radius
 * svgY = center - stereonetY * radius
 */
function toSvg(p: StereonetPoint, center: number, radius: number): { x: number; y: number } {
  return {
    x: center + p.x * radius,
    y: center - p.y * radius,
  };
}

function fmt(n: number): string {
  return n.toFixed(4);
}

/** Computes the shortest distance from point (px, py) to segment (x1, y1)-(x2, y2). */
function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

/**
 * Deterministic hit-testing helper.
 * Priority order:
 *   1. Poles & lineations (point features have precedence)
 *   2. Great circles
 */
function findHitFeature(
  svgX: number,
  svgY: number,
  center: number,
  radius: number,
  poles: readonly StereonetPole[],
  lineations: readonly StereonetLineation[],
  greatCircles: readonly StereonetGreatCircle[],
): StereonetFeature | null {
  let closestPointDist = Infinity;
  let hitPointFeature: StereonetFeature | null = null;

  // 1. Poles
  for (const pole of poles) {
    const pt = toSvg(pole.point, center, radius);
    const dist = Math.hypot(svgX - pt.x, svgY - pt.y);
    if (dist <= POINT_HIT_RADIUS_SVG && dist < closestPointDist) {
      closestPointDist = dist;
      hitPointFeature = { type: 'pole', id: pole.id };
    }
  }

  // 2. Lineations
  for (const lin of lineations) {
    const pt = toSvg(lin.point, center, radius);
    const dist = Math.hypot(svgX - pt.x, svgY - pt.y);
    if (dist <= POINT_HIT_RADIUS_SVG && dist < closestPointDist) {
      closestPointDist = dist;
      hitPointFeature = { type: 'lineation', id: lin.id };
    }
  }

  if (hitPointFeature) {
    return hitPointFeature;
  }

  // 3. Great circles
  let closestGcDist = Infinity;
  let hitGcFeature: StereonetFeature | null = null;

  for (const gc of greatCircles) {
    if (gc.points.length === 1) {
      const p = toSvg(gc.points[0], center, radius);
      const dist = Math.hypot(svgX - p.x, svgY - p.y);
      if (dist <= GREAT_CIRCLE_HIT_RADIUS_SVG && dist < closestGcDist) {
        closestGcDist = dist;
        hitGcFeature = { type: 'greatCircle', id: gc.id };
      }
    } else if (gc.points.length > 1) {
      for (let i = 0; i < gc.points.length - 1; i++) {
        const p1 = toSvg(gc.points[i], center, radius);
        const p2 = toSvg(gc.points[i + 1], center, radius);
        const dist = pointToSegmentDistance(svgX, svgY, p1.x, p1.y, p2.x, p2.y);
        if (dist <= GREAT_CIRCLE_HIT_RADIUS_SVG && dist < closestGcDist) {
          closestGcDist = dist;
          hitGcFeature = { type: 'greatCircle', id: gc.id };
        }
      }
    }
  }

  return hitGcFeature;
}

function isFeatureSelected(
  feature: { type: 'pole' | 'lineation' | 'greatCircle'; id: string },
  selection: StereonetSelection | null | undefined,
): boolean {
  return (
    selection !== null &&
    selection !== undefined &&
    selection.type === feature.type &&
    selection.id === feature.id
  );
}

function getSvgCoordinates(
  e: React.PointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>,
  svgElement: SVGSVGElement | null,
  size: number,
): { svgX: number; svgY: number } | null {
  if (!svgElement) return null;
  const rect = svgElement.getBoundingClientRect();
  const width = rect.width || size;
  const height = rect.height || size;
  const left = rect.left || 0;
  const top = rect.top || 0;
  const svgX = ((e.clientX - left) / width) * size;
  const svgY = ((e.clientY - top) / height) * size;
  return { svgX, svgY };
}

/**
 * Reusable SVG stereonet visualization component.
 *
 * Accepts already-projected StereonetPoint data (produced by
 * @geokinematics/geometry) and renders them onto an equal-angle Wulff net.
 * No projection mathematics are performed here.
 */
export function Stereonet({
  size = 400,
  gridInterval = 10,
  showGrid = true,
  showLabels = true,
  lineations = [],
  poles = [],
  greatCircles = [],
  overlayRegions = [],
  overlayCurves = [],
  selection = null,
  onSelectionChange,
  onHover,
  onCursorMove,
}: StereonetProps): React.ReactElement {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const labelPad = showLabels ? 24 : 10;
  const radius = (size - labelPad * 2) / 2;
  const center = size / 2;

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const coords = getSvgCoordinates(e, svgRef.current, size);
    if (!coords) return;
    const { svgX, svgY } = coords;
    const sx = (svgX - center) / radius;
    const sy = (center - svgY) / radius;
    const dist = Math.hypot(sx, sy);

    if (dist <= 1) {
      try {
        const orientation = unprojectLine({ x: sx, y: sy });
        onCursorMove?.({
          x: sx,
          y: sy,
          trend: orientation.trend,
          plunge: orientation.plunge,
        });
      } catch {
        onCursorMove?.(null);
      }
    } else {
      onCursorMove?.(null);
    }

    const hit = findHitFeature(svgX, svgY, center, radius, poles, lineations, greatCircles);
    onHover?.(hit);
  };

  const handlePointerLeave = () => {
    onCursorMove?.(null);
    onHover?.(null);
  };

  const handleClick = (e: React.PointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>) => {
    const coords = getSvgCoordinates(e, svgRef.current, size);
    if (!coords) return;
    const hit = findHitFeature(
      coords.svgX,
      coords.svgY,
      center,
      radius,
      poles,
      lineations,
      greatCircles,
    );
    if (hit) {
      onSelectionChange?.(hit);
    }
  };

  // ── Wulff grid ──────────────────────────────────────────────────────────────
  // The Wulff net consists of:
  //   Meridians – great circles connecting N and S through varying azimuths.
  //   Parallels – small circles at constant dip angles.
  // Both families are rendered as SVG arc paths derived from their
  // geometric radii and centre offsets, not from stereonet projection calls.

  const gridLines: React.ReactNode[] = [];

  if (showGrid && gridInterval > 0 && gridInterval < 90) {
    // N–S axis and E–W axis
    gridLines.push(
      <line
        key="axis-ns"
        x1={fmt(center)}
        y1={fmt(center - radius)}
        x2={fmt(center)}
        y2={fmt(center + radius)}
        stroke="#d0d0d0"
        strokeWidth={0.75}
      />,
      <line
        key="axis-ew"
        x1={fmt(center - radius)}
        y1={fmt(center)}
        x2={fmt(center + radius)}
        y2={fmt(center)}
        stroke="#d0d0d0"
        strokeWidth={0.75}
      />,
    );

    for (let deg = gridInterval; deg < 90; deg += gridInterval) {
      const rad = (deg * Math.PI) / 180;

      // ── Meridians ────────────────────────────────────────────────────────
      // A Wulff meridian at angle `deg` from N–S has its arc radius = R/sin(deg)
      // and is centred on the E–W axis at offset ±R/tan(deg) from centre.
      const mArcR = radius / Math.sin(rad);

      gridLines.push(
        <path
          key={`mer-e-${deg}`}
          d={`M ${fmt(center)} ${fmt(center - radius)} A ${fmt(mArcR)} ${fmt(mArcR)} 0 0 1 ${fmt(center)} ${fmt(center + radius)}`}
          fill="none"
          stroke="#d0d0d0"
          strokeWidth={0.75}
        />,
        <path
          key={`mer-w-${deg}`}
          d={`M ${fmt(center)} ${fmt(center - radius)} A ${fmt(mArcR)} ${fmt(mArcR)} 0 0 0 ${fmt(center)} ${fmt(center + radius)}`}
          fill="none"
          stroke="#d0d0d0"
          strokeWidth={0.75}
        />,
      );

      // ── Parallels ────────────────────────────────────────────────────────
      const pArcR = radius / Math.sin(rad);
      const pHalfWidth = radius * Math.cos(rad);

      const pWx = fmt(center - pHalfWidth);
      const pEx = fmt(center + pHalfWidth);
      const pArcRf2 = fmt(pArcR);
      const cy = fmt(center);

      // Northern parallel (upper half, arc bulges upward)
      gridLines.push(
        <path
          key={`par-n-${deg}`}
          d={`M ${pWx} ${cy} A ${pArcRf2} ${pArcRf2} 0 0 1 ${pEx} ${cy}`}
          fill="none"
          stroke="#d0d0d0"
          strokeWidth={0.75}
        />,
      );
      // Southern parallel (lower half, arc bulges downward)
      gridLines.push(
        <path
          key={`par-s-${deg}`}
          d={`M ${pWx} ${cy} A ${pArcRf2} ${pArcRf2} 0 0 0 ${pEx} ${cy}`}
          fill="none"
          stroke="#d0d0d0"
          strokeWidth={0.75}
        />,
      );
    }
  } else if (showGrid) {
    // gridInterval === 0 or ≥ 90: just render the two axes
    gridLines.push(
      <line
        key="axis-ns"
        x1={fmt(center)}
        y1={fmt(center - radius)}
        x2={fmt(center)}
        y2={fmt(center + radius)}
        stroke="#d0d0d0"
        strokeWidth={0.75}
      />,
      <line
        key="axis-ew"
        x1={fmt(center - radius)}
        y1={fmt(center)}
        x2={fmt(center + radius)}
        y2={fmt(center)}
        stroke="#d0d0d0"
        strokeWidth={0.75}
      />,
    );
  }

  // ── Great circles ────────────────────────────────────────────────────────────
  const gcPaths = greatCircles.map((gc) => {
    if (gc.points.length === 0) return null;
    const d = gc.points
      .map((p, j) => {
        const pt = toSvg(p, center, radius);
        return `${j === 0 ? 'M' : 'L'} ${fmt(pt.x)} ${fmt(pt.y)}`;
      })
      .join(' ');
    const isSelected = isFeatureSelected({ type: 'greatCircle', id: gc.id }, selection);
    return (
      <path
        key={gc.id}
        data-id={gc.id}
        data-type="greatCircle"
        data-selected={isSelected ? 'true' : undefined}
        aria-selected={isSelected ? true : undefined}
        d={d}
        fill="none"
        stroke={isSelected ? '#f59e0b' : '#cc2200'}
        strokeWidth={isSelected ? 3 : 1.5}
      />
    );
  });

  // ── Lineation markers ────────────────────────────────────────────────────────
  const lineationMarkers = lineations.map((lineation) => {
    const pt = toSvg(lineation.point, center, radius);
    const isSelected = isFeatureSelected({ type: 'lineation', id: lineation.id }, selection);
    return (
      <circle
        key={lineation.id}
        data-id={lineation.id}
        data-type="lineation"
        data-selected={isSelected ? 'true' : undefined}
        aria-selected={isSelected ? true : undefined}
        cx={fmt(pt.x)}
        cy={fmt(pt.y)}
        r={4}
        fill="#1a56db"
        stroke={isSelected ? '#f59e0b' : '#fff'}
        strokeWidth={isSelected ? 2.5 : 0.75}
      />
    );
  });

  // ── Pole markers ─────────────────────────────────────────────────────────────
  const poleMarkers = poles.map((pole) => {
    const pt = toSvg(pole.point, center, radius);
    const half = 4;
    const isSelected = isFeatureSelected({ type: 'pole', id: pole.id }, selection);
    const style = pole.status === undefined ? NEUTRAL_POLE_STYLE : POLE_STATUS_STYLE[pole.status];
    return (
      <rect
        key={pole.id}
        data-id={pole.id}
        data-type="pole"
        data-status={pole.status}
        data-selected={isSelected ? 'true' : undefined}
        aria-selected={isSelected ? true : undefined}
        x={fmt(pt.x - half)}
        y={fmt(pt.y - half)}
        width={half * 2}
        height={half * 2}
        fill={style.fill}
        stroke={isSelected ? '#f59e0b' : style.stroke}
        strokeWidth={isSelected ? 2.5 : style.strokeWidth}
      >
        {pole.status !== undefined && (
          <title>{pole.status === 'admissible' ? 'Admissible' : 'Rejected'}</title>
        )}
      </rect>
    );
  });

  // ── Overlay layers ───────────────────────────────────────────────────────────
  // Regions and boundary curves are drawn beneath features and ignore pointer
  // events, so hit-testing and selection are unaffected.

  const ringPath = (ring: ReadonlyArray<StereonetPoint>): string =>
    ring
      .map((p, j) => {
        const pt = toSvg(p, center, radius);
        return `${j === 0 ? 'M' : 'L'} ${fmt(pt.x)} ${fmt(pt.y)}`;
      })
      .join(' ') + ' Z';

  const overlayRegionPaths = overlayRegions.map((region) => (
    <path
      key={region.id}
      data-id={region.id}
      data-type="overlayRegion"
      d={region.rings.map(ringPath).join(' ')}
      fill={OVERLAY_ADMISSIBLE_FILL}
      fillRule="evenodd"
      stroke="none"
      pointerEvents="none"
    >
      <title>{region.label}</title>
    </path>
  ));

  const overlayCurvePaths = overlayCurves.map((curve) => {
    if (curve.points.length === 0) return null;
    const d = curve.points
      .map((p, j) => {
        const pt = toSvg(p, center, radius);
        return `${j === 0 ? 'M' : 'L'} ${fmt(pt.x)} ${fmt(pt.y)}`;
      })
      .join(' ');
    return (
      <path
        key={curve.id}
        data-id={curve.id}
        data-type="overlayCurve"
        data-dashed={curve.dashed ? 'true' : undefined}
        d={d}
        fill="none"
        stroke={OVERLAY_BOUNDARY_STROKE}
        strokeWidth={1.5}
        strokeDasharray={curve.dashed ? '5 4' : undefined}
        pointerEvents="none"
      >
        <title>{curve.label}</title>
      </path>
    );
  });

  // ── Cardinal labels ──────────────────────────────────────────────────────────
  const labelOffset = 14;
  const degLabelOffset = 12;
  const cardinalFontSize = 13;
  const degFontSize = 9;

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label="stereonet"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
    >
      {/* Primitive circle background */}
      <circle
        data-testid="primitive-circle"
        cx={fmt(center)}
        cy={fmt(center)}
        r={fmt(radius)}
        fill="#fafafa"
        stroke="#333"
        strokeWidth={1.5}
      />

      {/* Wulff grid */}
      {showGrid && <g data-testid="stereonet-grid">{gridLines}</g>}

      {/* Overlay regions and boundary curves (non-interactive) */}
      <g data-testid="overlay-regions">{overlayRegionPaths}</g>
      <g data-testid="overlay-curves">{overlayCurvePaths}</g>

      {/* Great circle paths */}
      <g data-testid="great-circles">{gcPaths}</g>

      {/* Lineations */}
      <g data-testid="lineations">{lineationMarkers}</g>

      {/* Poles */}
      <g data-testid="poles">{poleMarkers}</g>

      {/* Cardinal and degree labels */}
      {showLabels && (
        <g data-testid="stereonet-labels" fontFamily="system-ui, sans-serif" fill="#333">
          {/* N */}
          <text
            x={fmt(center)}
            y={fmt(center - radius - labelOffset)}
            fontSize={cardinalFontSize}
            textAnchor="middle"
            dominantBaseline="auto"
            fontWeight="600"
          >
            N
          </text>
          <text
            x={fmt(center)}
            y={fmt(center - radius - degLabelOffset + cardinalFontSize + 2)}
            fontSize={degFontSize}
            textAnchor="middle"
            dominantBaseline="auto"
            fill="#666"
          >
            000°
          </text>

          {/* E */}
          <text
            x={fmt(center + radius + labelOffset)}
            y={fmt(center)}
            fontSize={cardinalFontSize}
            textAnchor="start"
            dominantBaseline="middle"
            fontWeight="600"
          >
            E
          </text>
          <text
            x={fmt(center + radius + labelOffset + cardinalFontSize + 2)}
            y={fmt(center)}
            fontSize={degFontSize}
            textAnchor="start"
            dominantBaseline="middle"
            fill="#666"
          >
            090°
          </text>

          {/* S */}
          <text
            x={fmt(center)}
            y={fmt(center + radius + labelOffset + cardinalFontSize)}
            fontSize={cardinalFontSize}
            textAnchor="middle"
            dominantBaseline="auto"
            fontWeight="600"
          >
            S
          </text>
          <text
            x={fmt(center)}
            y={fmt(center + radius + labelOffset + cardinalFontSize + degFontSize + 2)}
            fontSize={degFontSize}
            textAnchor="middle"
            dominantBaseline="auto"
            fill="#666"
          >
            180°
          </text>

          {/* W */}
          <text
            x={fmt(center - radius - labelOffset)}
            y={fmt(center)}
            fontSize={cardinalFontSize}
            textAnchor="end"
            dominantBaseline="middle"
            fontWeight="600"
          >
            W
          </text>
          <text
            x={fmt(center - radius - labelOffset - cardinalFontSize - 2)}
            y={fmt(center)}
            fontSize={degFontSize}
            textAnchor="end"
            dominantBaseline="middle"
            fill="#666"
          >
            270°
          </text>
        </g>
      )}
    </svg>
  );
}
