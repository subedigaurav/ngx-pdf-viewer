import { DestroyRef, ElementRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import { debounceTime, filter } from 'rxjs/operators';
import { isSSR } from '../../core/config/viewer-config';
import { RESIZE_DEBOUNCE_TIME } from '../../core/constants/viewer-constants';
import type { HandToolCleanup } from '../../core/models/viewer.model';
import { setupHandTool } from '../../core/utils/pdf-hand-tool';

@Injectable()
export class PdfViewerHostService {
  private readonly hostElement = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private handToolCleanup: HandToolCleanup | null = null;
  private handToolContainer: HTMLElement | null = null;
  private handToolEnabled: boolean | null = null;

  observeVisibility(onVisibilityChange: (visible: boolean) => void): void {
    if (isSSR()) return;
    if (typeof IntersectionObserver === 'undefined') {
      onVisibilityChange(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        onVisibilityChange(entries.some((entry) => entry.isIntersecting));
      },
      { threshold: 0 },
    );
    observer.observe(this.hostElement.nativeElement);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  observeResize(shouldResize: () => boolean, onResize: () => void): void {
    if (isSSR()) return;

    fromEvent(window, 'resize')
      .pipe(filter(shouldResize), debounceTime(RESIZE_DEBOUNCE_TIME), takeUntilDestroyed(this.destroyRef))
      .subscribe(onResize);

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (shouldResize()) onResize();
    });
    observer.observe(this.hostElement.nativeElement);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  /**
   * Idempotent: re-running with the same container and flag is a no-op, because
   * a rebuild runs the cleanup, which would cancel an in-progress pan.
   */
  setHandTool(container: HTMLElement, enabled: boolean): void {
    if (this.handToolContainer === container && this.handToolEnabled === enabled) return;
    this.clearHandTool();
    this.handToolContainer = container;
    this.handToolEnabled = enabled;
    this.handToolCleanup = setupHandTool(container, enabled);
  }

  clearHandTool(): void {
    this.handToolCleanup?.();
    this.handToolCleanup = null;
    this.handToolContainer = null;
    this.handToolEnabled = null;
  }
}
