import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { PDFPageProxy } from '../models/pdf-document.model';
import type { ScaleContext, ViewerSyncState } from '../models/pdf-viewer.model';
import {
  calculatePdfScale,
  roundScaleToIncrement,
  toIntegerPageNumber,
} from '../utils/pdf-scale.util';
import type { PdfViewerFacadeService } from './pdf-viewer-facade.service';

/**
 * Handles PDF viewer scale/zoom logic only.
 * Single responsibility: calculate and apply scale to fit page in container.
 */
@Injectable()
export class PdfViewerScaleService {
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Updates scale and triggers rendering.
   * Sets current page, handles rotation, then applies scale.
   */
  updateScaleAndRender(
    facade: PdfViewerFacadeService,
    context: ScaleContext,
    scaleConfig: ViewerSyncState['scale'],
    page: number,
  ): void {
    const { viewer } = context;
    facade.setCurrentPage(page);

    const apply = (): void => {
      if (viewer.pagesRotation !== scaleConfig.rotation) {
        viewer.pagesRotation = scaleConfig.rotation;
      }
      this.applyScale(facade, context, scaleConfig);
    };

    viewer.firstPagePromise ? viewer.firstPagePromise.then(apply) : apply();
  }

  /**
   * Applies scale to the current page and forces re-render.
   */
  applyScale(
    facade: PdfViewerFacadeService,
    context: ScaleContext,
    scaleConfig: ViewerSyncState['scale'],
  ): void {
    const { container, doc, viewer, stickToPage, onError } = context;
    const pageNumber = toIntegerPageNumber(viewer.currentPageNumber, doc.numPages);

    facade
      .getPage(pageNumber)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page: PDFPageProxy) => {
          const totalRotation = scaleConfig.rotation + page.rotate;
          const viewport = page.getViewport({ scale: 1, rotation: totalRotation });

          const isOriginalSize = scaleConfig.originalSize;
          const scale = isOriginalSize
            ? roundScaleToIncrement(scaleConfig.zoom)
            : calculatePdfScale({
                viewportWidth: viewport.width,
                viewportHeight: viewport.height,
                containerWidth: container.clientWidth,
                containerHeight: container.clientHeight,
                zoom: scaleConfig.zoom,
                zoomScale: scaleConfig.zoomScale,
                showBorders: scaleConfig.showBorders,
              });

          viewer.currentScale = scale;

          if (!isOriginalSize && !stickToPage) {
            viewer.scrollPageIntoView({
              pageNumber: toIntegerPageNumber(page.pageNumber, doc.numPages),
              ignoreDestinationZoom: true,
            });
          }

          facade.forceRendering();
        },
        error: (err) => onError(err instanceof Error ? err : new Error(String(err))),
      });
  }
}
