/** CSS units conversion factor: 96 DPI / 72 points per inch */
export const CSS_UNITS = 96.0 / 72.0;

export const BORDER_WIDTH = 9;

/** Scale increment for snapping (e.g. 0.05 = 5% steps: 0.5, 0.55, 1.0, 1.05...) */
export const SCALE_INCREMENT = 0.05;

export const RESIZE_DEBOUNCE_TIME = 100;

export const PAGE_CHANGE_DEBOUNCE_TIME = 100;

export const HAND_TOOL_CLASSES = {
  GRAB: 'grab-to-pan-grab',
  GRABBING: 'grab-to-pan-grabbing',
} as const;
