import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { take } from 'rxjs/operators';
import type { PDFPageProxy } from '../../core/models/pdf-document.model';
import { toPdfViewerError } from '../../core/models/viewer-error.model';
import type { ScaleContext, ViewerSyncState } from '../../core/models/viewer.model';
import { calculatePdfScale, roundScaleToIncrement, toIntegerPageNumber } from '../../core/utils/pdf-scale';
import type { PdfViewerFacadeService } from './viewer-facade.service';

/** Handles PDF viewer scale/zoom logic only. */
@Injectable()
export class PdfViewerScaleService {
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Applies rotation and scale, then triggers rendering.
   *
   * Does not move the scroll position: pdf.js's `currentScale` setter already
   * re-anchors the view through `_location`, preserving the intra-page offset.
   */
  updateScaleAndRender(
    facade: PdfViewerFacadeService,
    context: ScaleContext,
    scaleConfig: ViewerSyncState['scale'],
  ): void {
    const { viewer } = context;

    const apply = (): void => {
      if (viewer.pagesRotation !== scaleConfig.rotation) {
        viewer.pagesRotation = scaleConfig.rotation;
      }
      this.applyScale(facade, context, scaleConfig);
    };

    if (viewer.firstPagePromise) {
      viewer.firstPagePromise.then(apply);
    } else {
      apply();
    }
  }

  applyScale(facade: PdfViewerFacadeService, context: ScaleContext, scaleConfig: ViewerSyncState['scale']): void {
    const { container, doc, viewer, onError } = context;
    const pageNumber = toIntegerPageNumber(viewer.currentPageNumber, doc.numPages);

    facade
      .getPage(pageNumber)
      // take(1) so each call's subscription completes rather than living on
      // until component teardown.
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
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

          facade.forceRendering();
        },
        error: (err) => onError(toPdfViewerError(err)),
      });
  }
}
