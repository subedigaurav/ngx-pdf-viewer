import { BORDER_WIDTH, CSS_UNITS, SCALE_INCREMENT } from '../constants/pdf-viewer.constants';
import type { ScaleCalculationParams } from '../models/pdf-viewer.model';

/**
 * Computes container/viewport ratio when both dimensions are valid.
 * Returns null when either is zero or invalid.
 */
function computeRatio(container: number, viewport: number): number | null {
  return container > 0 && viewport > 0 && Number.isFinite(container) && Number.isFinite(viewport)
    ? container / viewport
    : null;
}

/**
 * Snaps scale to the nearest increment for clean, predictable zoom levels.
 */
export function roundScaleToIncrement(scale: number, increment = SCALE_INCREMENT): number {
  if (Number.isFinite(scale) && scale > 0) {
    const snapped = Math.round(scale / increment) * increment;
    return snapped >= increment ? snapped : increment;
  }
  return 1;
}

/**
 * Calculates the scale factor for PDF page rendering based on container dimensions,
 * zoom settings, and scale mode.
 *
 * @param params - Scale calculation parameters
 * @returns The calculated scale factor (snapped to increment)
 */
export function calculatePdfScale({
  viewportWidth,
  viewportHeight,
  containerWidth,
  containerHeight,
  zoom,
  zoomScale,
  showBorders,
}: ScaleCalculationParams): number {
  if (viewportWidth <= 0 || viewportHeight <= 0) return 1;

  const border = showBorders ? 2 * BORDER_WIDTH : 0;
  const availableWidth = containerWidth - border;
  const availableHeight = containerHeight - border;

  const widthRatio = computeRatio(availableWidth, viewportWidth);
  const heightRatio = computeRatio(availableHeight, viewportHeight);

  const getRatio = (): number => {
    switch (zoomScale) {
      case 'page-fit': {
        const ratios = [widthRatio, heightRatio].filter((r): r is number => r != null && r > 0);
        return ratios.length ? Math.min(...ratios) : 1;
      }
      case 'page-height':
        return heightRatio ?? 1;
      case 'page-width':
      default:
        return widthRatio ?? 1;
    }
  };

  const scale = (zoom * getRatio()) / CSS_UNITS;
  return roundScaleToIncrement(scale);
}

/**
 * Coerces a value to a valid integer page number for PDF.js APIs.
 * PDF.js requires Number.isInteger(pageNumber).
 *
 * @param value - Page number (may be string from bindings/URL/events)
 * @param totalPages - Optional upper bound
 * @returns Integer between 1 and totalPages (or 1 if totalPages invalid)
 */
export function toIntegerPageNumber(value: unknown, totalPages?: number): number {
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  const page = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  const max = totalPages != null && totalPages > 0 ? totalPages : page;
  return Math.max(1, Math.min(page, max));
}

/**
 * Validates and normalizes a page number within valid bounds
 *
 * @param page - The page number to validate
 * @param totalPages - The total number of pages in the document
 * @returns A valid page number between 1 and totalPages
 */
export function normalizePageNumber(page: number, totalPages: number): number {
  return toIntegerPageNumber(page, totalPages);
}
