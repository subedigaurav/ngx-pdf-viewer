/**
 * PDF viewer rendering and layout constants
 */

/**
 * CSS units conversion factor: 96 DPI / 72 points per inch
 */
export const CSS_UNITS = 96.0 / 72.0;

/**
 * Border width in pixels used for scale calculations when borders are shown
 */
export const BORDER_WIDTH = 9;

/**
 * Scale increment for snapping (e.g. 0.05 = 5% steps: 0.5, 0.55, 1.0, 1.05...)
 */
export const SCALE_INCREMENT = 0.05;

/**
 * Default debounce time for resize events in milliseconds
 */
export const RESIZE_DEBOUNCE_TIME = 100;

/**
 * Default page change debounce time in milliseconds
 */
export const PAGE_CHANGE_DEBOUNCE_TIME = 100;

/**
 * Default PDF.js CDN base URL
 */
export const DEFAULT_CDN_BASE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist';

/**
 * Default PDF.js version for CDN fallback
 */
export const DEFAULT_VERSION = '5.4.624';

/**
 * CSS classes for hand tool (grab-to-pan) functionality
 */
export const HAND_TOOL_CLASSES = {
  GRAB: 'grab-to-pan-grab',
  GRABBING: 'grab-to-pan-grabbing',
} as const;
