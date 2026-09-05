import { HAND_TOOL_CLASSES } from '../constants/viewer-constants';
import type { HandToolCleanup } from '../models/viewer.model';

interface PanState {
  x: number;
  y: number;
  scrollLeft: number;
  scrollTop: number;
}

const OVERLAY_STYLE: Partial<CSSStyleDeclaration> = {
  position: 'fixed',
  inset: '0',
  cursor: 'grabbing',
  zIndex: '50000',
  pointerEvents: 'auto',
};

function createOverlay(className: string): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.className = className;
  Object.assign(overlay.style, OVERLAY_STYLE);
  return overlay;
}

/**
 * Sets up grab-to-pan (hand tool) on a scrollable container.
 * Left-click and drag pans the content.
 */
export function setupHandTool(container: HTMLElement, enabled: boolean): HandToolCleanup {
  if (!enabled) {
    container.classList.remove(HAND_TOOL_CLASSES.GRAB);
    return () => {};
  }

  container.classList.add(HAND_TOOL_CLASSES.GRAB);

  let panState: PanState | null = null;
  const overlay = createOverlay(HAND_TOOL_CLASSES.GRABBING);

  function handleMouseMove(event: MouseEvent): void {
    if (!panState) return;
    event.preventDefault();
    container.scrollLeft = panState.scrollLeft + (panState.x - event.clientX);
    container.scrollTop = panState.scrollTop + (panState.y - event.clientY);
  }

  function endPanSession(): void {
    panState = null;
    overlay.remove();
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', endPanSession);
  }

  /**
   * Starts a pan session if user left-clicks the container.
   */
  function handleMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();

    panState = {
      x: event.clientX,
      y: event.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    };

    container.append(overlay);
    window.addEventListener('mousemove', handleMouseMove, { passive: false });
    window.addEventListener('mouseup', endPanSession);
  }

  container.addEventListener('mousedown', handleMouseDown);

  return (): void => {
    endPanSession();
    container.classList.remove(HAND_TOOL_CLASSES.GRAB);
    container.removeEventListener('mousedown', handleMouseDown);
  };
}
