import { describe, expect, it } from 'vitest';
import { chooseAnchor } from './popupPlacement';

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
