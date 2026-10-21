import { describe, expect, it } from 'vitest';
import { chooseAnchor, overflowShift } from './popupPlacement';

const view = { width: 1200, height: 800 };
const pad = { top: 20, right: 300, bottom: 190, left: 300 };
const card = { width: 320, height: 300 };

describe('chooseAnchor', () => {
  it('puts the card above the point when it fits there', () => {
    expect(chooseAnchor({ x: 600, y: 500 }, card, view, pad)).toBe('bottom');
  });

  it('puts it below when only below has room', () => {
    expect(chooseAnchor({ x: 600, y: 150 }, card, view, pad)).toBe('top');
  });

  it('never hangs it below into the bottom dock when above has more room', () => {
    // 298 px above, 268 above the dock: neither fits. MapLibre would hang it
    // below (the point is within a card-height of the top), into the dock.
    expect(chooseAnchor({ x: 600, y: 330 }, card, view, pad)).toBe('bottom');
  });

  it('shifts sideways next to a panel', () => {
    expect(chooseAnchor({ x: 380, y: 500 }, card, view, pad)).toBe('bottom-left');
    expect(chooseAnchor({ x: 840, y: 500 }, card, view, pad)).toBe('bottom-right');
  });
});

describe('overflowShift', () => {
  const tall = { width: 320, height: 520 };

  it('leaves a card that fits alone', () => {
    expect(overflowShift({ x: 600, y: 500 }, card, view, pad, 'bottom')).toBe(0);
  });

  it('scrolls the map down until a card above its point fits', () => {
    // 520 + 12 px tip, 460 px between the point and the top inset.
    expect(overflowShift({ x: 600, y: 480 }, tall, view, pad, 'bottom')).toBe(72);
  });

  it('scrolls it up for a card below its point', () => {
    // 510 px below the point, above the dock.
    expect(overflowShift({ x: 600, y: 100 }, tall, view, pad, 'top')).toBe(-22);
  });

  it('gives up on a card taller than the visible map', () => {
    expect(
      overflowShift({ x: 600, y: 480 }, { width: 320, height: 700 }, view, pad, 'bottom'),
    ).toBe(0);
  });
});
