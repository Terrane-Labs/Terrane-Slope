import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { Stereonet } from '../src/Stereonet';
import type { StereonetOverlayCurve, StereonetOverlayRegion } from '../src/stereonet-types';

afterEach(cleanup);

const SIZE = 200; // showLabels=false → pad 10, radius 90, centre 100

const region: StereonetOverlayRegion = {
  id: 'zone-a',
  label: 'Admissible zone',
  rings: [
    [
      { x: -0.5, y: -0.5 },
      { x: 0.5, y: -0.5 },
      { x: 0.5, y: 0.5 },
    ],
    [
      { x: -0.1, y: -0.1 },
      { x: 0.1, y: -0.1 },
      { x: 0.1, y: 0.1 },
    ],
  ],
};

const solidCurve: StereonetOverlayCurve = {
  id: 'curve-solid',
  label: 'Solid boundary',
  points: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ],
  dashed: false,
};

const dashedCurve: StereonetOverlayCurve = { ...solidCurve, id: 'curve-dashed', dashed: true };

describe('pole status', () => {
  it('uses the neutral marker and no data-status when status is absent', () => {
    const { container } = render(
      <Stereonet size={SIZE} showLabels={false} poles={[{ id: 'p', point: { x: 0, y: 0 } }]} />,
    );
    const rect = container.querySelector('rect[data-id="p"]')!;
    expect(rect.hasAttribute('data-status')).toBe(false);
    expect(rect.getAttribute('fill')).toBe('#15803d');
    expect(rect.querySelector('title')).toBeNull();
  });

  it('renders admissible poles filled and rejected poles hollow', () => {
    const { container } = render(
      <Stereonet
        size={SIZE}
        showLabels={false}
        poles={[
          { id: 'ok', point: { x: 0.1, y: 0 }, status: 'admissible' },
          { id: 'no', point: { x: -0.1, y: 0 }, status: 'rejected' },
        ]}
      />,
    );
    const ok = container.querySelector('rect[data-id="ok"]')!;
    const no = container.querySelector('rect[data-id="no"]')!;
    expect(ok.getAttribute('data-status')).toBe('admissible');
    expect(no.getAttribute('data-status')).toBe('rejected');
    expect(ok.getAttribute('fill')).not.toBe('#ffffff');
    expect(no.getAttribute('fill')).toBe('#ffffff');
    expect(ok.querySelector('title')?.textContent).toBe('Admissible');
    expect(no.querySelector('title')?.textContent).toBe('Rejected');
  });

  it('keeps the amber selection ring regardless of status', () => {
    const { container } = render(
      <Stereonet
        size={SIZE}
        showLabels={false}
        poles={[{ id: 'no', point: { x: 0, y: 0 }, status: 'rejected' }]}
        selection={{ type: 'pole', id: 'no' }}
      />,
    );
    expect(container.querySelector('rect[data-id="no"]')!.getAttribute('stroke')).toBe('#f59e0b');
  });
});

describe('overlay layers', () => {
  it('renders nothing in the overlay groups by default', () => {
    const { container } = render(<Stereonet size={SIZE} showLabels={false} />);
    expect(container.querySelector('[data-testid="overlay-regions"]')!.children).toHaveLength(0);
    expect(container.querySelector('[data-testid="overlay-curves"]')!.children).toHaveLength(0);
  });

  it('renders each ring as a closed sub-path with even-odd fill', () => {
    const { container } = render(
      <Stereonet size={SIZE} showLabels={false} overlayRegions={[region]} />,
    );
    const path = container.querySelector('path[data-id="zone-a"]')!;
    expect(path.getAttribute('fill-rule')).toBe('evenodd');
    const d = path.getAttribute('d')!;
    expect(d.match(/M /g)).toHaveLength(2);
    expect(d.match(/Z/g)).toHaveLength(2);
    // (-0.5, -0.5) → svg (100 - 45, 100 + 45)
    expect(d.startsWith('M 55.0000 145.0000')).toBe(true);
    expect(path.querySelector('title')?.textContent).toBe('Admissible zone');
  });

  it('renders a dashed curve with a dash pattern and a solid curve without', () => {
    const { container } = render(
      <Stereonet size={SIZE} showLabels={false} overlayCurves={[solidCurve, dashedCurve]} />,
    );
    const solid = container.querySelector('path[data-id="curve-solid"]')!;
    const dashed = container.querySelector('path[data-id="curve-dashed"]')!;
    expect(solid.hasAttribute('stroke-dasharray')).toBe(false);
    expect(dashed.getAttribute('stroke-dasharray')).toBe('5 4');
    expect(dashed.getAttribute('data-dashed')).toBe('true');
    expect(solid.getAttribute('d')).toBe('M 100.0000 100.0000 L 190.0000 100.0000');
  });

  it('draws overlays before great circles, lineations, and poles', () => {
    const { container } = render(
      <Stereonet
        size={SIZE}
        showLabels={false}
        overlayRegions={[region]}
        poles={[{ id: 'p', point: { x: 0, y: 0 } }]}
      />,
    );
    const order = Array.from(container.querySelectorAll('svg > g'))
      .map((g) => g.getAttribute('data-testid'))
      .filter((id): id is string => id !== null);
    expect(order.indexOf('overlay-regions')).toBeLessThan(order.indexOf('great-circles'));
    expect(order.indexOf('overlay-curves')).toBeLessThan(order.indexOf('poles'));
  });

  it('disables pointer events on overlay paths', () => {
    const { container } = render(
      <Stereonet
        size={SIZE}
        showLabels={false}
        overlayRegions={[region]}
        overlayCurves={[solidCurve]}
      />,
    );
    expect(container.querySelector('path[data-id="zone-a"]')!.getAttribute('pointer-events')).toBe(
      'none',
    );
    expect(
      container.querySelector('path[data-id="curve-solid"]')!.getAttribute('pointer-events'),
    ).toBe('none');
  });

  it('does not change hit-testing: clicking a pole beneath an overlay still selects it', () => {
    const onSelectionChange = vi.fn();
    const { container } = render(
      <Stereonet
        size={SIZE}
        showLabels={false}
        overlayRegions={[region]}
        overlayCurves={[solidCurve]}
        poles={[{ id: 'p', point: { x: 0, y: 0 } }]}
        onSelectionChange={onSelectionChange}
      />,
    );
    fireEvent.click(container.querySelector('svg')!, { clientX: 100, clientY: 100 });
    expect(onSelectionChange).toHaveBeenCalledWith({ type: 'pole', id: 'p' });
  });

  it('does not select overlay paths', () => {
    const onSelectionChange = vi.fn();
    const { container } = render(
      <Stereonet
        size={SIZE}
        showLabels={false}
        overlayRegions={[region]}
        onSelectionChange={onSelectionChange}
      />,
    );
    fireEvent.click(container.querySelector('svg')!, { clientX: 120, clientY: 80 });
    expect(onSelectionChange).not.toHaveBeenCalled();
  });
});
