import { describe, expect, it } from 'vitest';
import { calculatePdfScale, normalizePageNumber, roundScaleToIncrement, toIntegerPageNumber } from './pdf-scale';

describe('roundScaleToIncrement', () => {
  it('snaps to nearest increment', () => {
    expect(roundScaleToIncrement(1.02)).toBeCloseTo(1.0);
    expect(roundScaleToIncrement(1.04)).toBeCloseTo(1.05);
  });

  it('floors at one increment', () => {
    expect(roundScaleToIncrement(0.01)).toBeCloseTo(0.05);
  });

  it('returns 1 for non-finite/negative input', () => {
    expect(roundScaleToIncrement(NaN)).toBe(1);
    expect(roundScaleToIncrement(-2)).toBe(1);
  });
});

describe('calculatePdfScale', () => {
  const base = { zoom: 1, showBorders: false };

  it('page-width divides container width by viewport width and CSS_UNITS', () => {
    const scale = calculatePdfScale({
      ...base,
      viewportWidth: 800,
      viewportHeight: 600,
      containerWidth: 1600,
      containerHeight: 1200,
      zoomScale: 'page-width',
    });
    expect(scale).toBeCloseTo(roundScaleToIncrement(1600 / 800 / (96 / 72)));
  });

  it('page-fit uses the min ratio', () => {
    // widthRatio = 1000/1000 = 1, heightRatio = 400/500 = 0.8 -> height wins.
    const scale = calculatePdfScale({
      ...base,
      viewportWidth: 1000,
      viewportHeight: 500,
      containerWidth: 1000,
      containerHeight: 400,
      zoomScale: 'page-fit',
    });
    expect(scale).toBeCloseTo(roundScaleToIncrement(400 / 500 / (96 / 72)));
  });

  it('subtracts borders when showBorders', () => {
    const s1 = calculatePdfScale({
      ...base,
      viewportWidth: 100,
      viewportHeight: 100,
      containerWidth: 200,
      containerHeight: 200,
      zoomScale: 'page-width',
    });
    const s2 = calculatePdfScale({
      ...base,
      showBorders: true,
      viewportWidth: 100,
      viewportHeight: 100,
      containerWidth: 200,
      containerHeight: 200,
      zoomScale: 'page-width',
    });
    expect(s2).toBeLessThan(s1);
  });

  it('returns 1 for zero viewport', () => {
    expect(
      calculatePdfScale({
        ...base,
        viewportWidth: 0,
        viewportHeight: 0,
        containerWidth: 100,
        containerHeight: 100,
        zoomScale: 'page-width',
      }),
    ).toBe(1);
  });
});

describe('toIntegerPageNumber', () => {
  it('coerces strings and clamps bounds', () => {
    expect(toIntegerPageNumber('3')).toBe(3);
    expect(toIntegerPageNumber('abc')).toBe(1);
    expect(toIntegerPageNumber(99, 10)).toBe(10);
    expect(toIntegerPageNumber(-5, 10)).toBe(1);
    expect(toIntegerPageNumber(2.7)).toBe(2);
  });
});

describe('normalizePageNumber', () => {
  it('delegates clamping', () => {
    expect(normalizePageNumber(5, 3)).toBe(3);
  });
});
