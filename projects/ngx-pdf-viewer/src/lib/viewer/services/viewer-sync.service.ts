import { Injectable } from '@angular/core';
import type { PDFDocumentProxy } from '../../core/models/pdf-document.model';
import type { ScaleContext, SyncStateTracker, ViewerSyncState } from '../../core/models/viewer.model';
import { normalizePageNumber, toIntegerPageNumber } from '../../core/utils/pdf-scale';
import type { PdfViewerFacadeService } from './viewer-facade.service';
import type { PdfViewerScaleService } from './viewer-scale.service';

/** Orchestrates viewer sync: reconfigure, page navigation, scale, hand tool, stick-to-page. */
@Injectable()
export class PdfViewerSyncService {
  /**
   * Syncs viewer state - reconfigure, page nav, scale, stick-to-page.
   * Hand tool is left to component (DOM-specific).
   */
  sync(
    state: ViewerSyncState,
    tracker: SyncStateTracker,
    context: {
      container: HTMLDivElement | null;
      scaleService: PdfViewerScaleService;
      facade: PdfViewerFacadeService;
      onReconfigure: (config: ViewerSyncState['reconfigure']) => Promise<void>;
      onHandTool: (enabled: boolean) => void;
      onLoadComplete: (doc: PDFDocumentProxy) => void;
      onError?: (err: Error) => void;
    },
  ): void {
    if (state.doc !== tracker.lastEmittedDoc) {
      tracker.lastEmittedDoc = state.doc;
      // A different document may have a different page size, so the scale has
      // to be recomputed even if every scale input stayed the same.
      tracker.lastScaleKey = '';
      context.onLoadComplete(state.doc);
    }

    context.onHandTool(state.enableHandTool);

    const reconfigureKey = `${state.reconfigure.renderText}-${state.reconfigure.renderTextMode}-${state.reconfigure.annotationMode}`;
    if (reconfigureKey !== tracker.lastReconfigureKey) {
      tracker.lastReconfigureKey = reconfigureKey;
      void context.onReconfigure(state.reconfigure);
      return;
    }

    // Only an explicit page change navigates: while scrolling, `pagechanging`
    // is echoed back into `page`, and latestScrolledPage already holds it.
    const targetPage = normalizePageNumber(state.page, state.doc.numPages);
    if (targetPage !== tracker.getLatestScrolledPage()) {
      tracker.setLatestScrolledPage(targetPage);
      context.facade.scrollToPage(targetPage, true);

      if (state.stickToPage) {
        // Re-assert once pdf.js settles its own scroll-driven page tracking.
        setTimeout(() => {
          const viewer = context.facade.getPdfViewer();
          if (viewer) {
            viewer.currentPageNumber = toIntegerPageNumber(targetPage, state.doc.numPages);
          }
        });
      }
    }

    const scaleKey = buildScaleKey(state.scale);
    if (context.container && scaleKey !== tracker.lastScaleKey) {
      tracker.lastScaleKey = scaleKey;
      const viewer = context.facade.getPdfViewer();
      const scaleContext: ScaleContext = {
        container: context.container,
        doc: state.doc,
        viewer,
        onError: context.onError ?? (() => {}),
      };
      context.scaleService.updateScaleAndRender(context.facade, scaleContext, state.scale);
    }
  }
}

/**
 * Fingerprints everything `updateScaleAndRender` reads. Resize-driven scale
 * changes bypass sync — the component calls the scale service directly.
 */
function buildScaleKey(scale: ViewerSyncState['scale']): string {
  return [scale.zoom, scale.zoomScale, scale.rotation, scale.originalSize, scale.fitToPage, scale.showBorders].join(
    '|',
  );
}
