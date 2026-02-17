import { HAND_TOOL_CLASSES } from '../constants/pdf-viewer.constants';
import type { HandToolCleanup } from '../models/pdf-viewer.model';

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
 *
 * @param container - Scrollable element to enable panning on
 * @param enabled - Whether hand tool is active
 * @returns Cleanup to remove listeners and classes
 */
export function setupHandTool(container: HTMLElement, enabled: boolean): HandToolCleanup {
  if (!enabled) {
    container.classList.remove(HAND_TOOL_CLASSES.GRAB);
    return () => {};
  }

  container.classList.add(HAND_TOOL_CLASSES.GRAB);

  let panState: PanState | null = null;
  const overlay = createOverlay(HAND_TOOL_CLASSES.GRABBING);

  /**
   * Moves the container content as the mouse moves, based on initial pan state.
   */
  function handleMouseMove(event: MouseEvent): void {
    if (!panState) return;
    event.preventDefault();
    container.scrollLeft = panState.scrollLeft + (panState.x - event.clientX);
    container.scrollTop = panState.scrollTop + (panState.y - event.clientY);
  }

  /**
   * Ends a pan session, removes overlay and event listeners.
   */
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

  /**
   * Cleanup function detaches all hand tool listeners and state.
   */
  return (): void => {
    endPanSession();
    container.classList.remove(HAND_TOOL_CLASSES.GRAB);
    container.removeEventListener('mousedown', handleMouseDown);
  };
}
