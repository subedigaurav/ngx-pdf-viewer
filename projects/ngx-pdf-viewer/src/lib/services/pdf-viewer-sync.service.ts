import { Injectable } from '@angular/core';
import type { PDFDocumentProxy } from '../models/pdf-document.model';
import type { ScaleContext, SyncStateTracker, ViewerSyncState } from '../models/pdf-viewer.model';
import { normalizePageNumber, toIntegerPageNumber } from '../utils/pdf-scale.util';
import type { PdfViewerFacadeService } from './pdf-viewer-facade.service';
import type { PdfViewerScaleService } from './pdf-viewer-scale.service';

/**
 * Orchestrates viewer sync: reconfigure, page navigation, scale, hand tool, stick-to-page.
 * Single responsibility: coordinate viewer updates based on state changes.
 */
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
      context.onLoadComplete(state.doc);
    }

    const reconfigureKey = `${state.reconfigure.renderText}-${state.reconfigure.renderTextMode}`;
    if (reconfigureKey !== tracker.lastReconfigureKey) {
      tracker.lastReconfigureKey = reconfigureKey;
      void context.onReconfigure(state.reconfigure);
      return;
    }

    const targetPage = normalizePageNumber(state.page, state.doc.numPages);
    if (targetPage !== tracker.getLatestScrolledPage()) {
      tracker.setLatestScrolledPage(targetPage);
      context.facade.scrollToPage(targetPage, true);
    }

    if (state.stickToPage) {
      setTimeout(() => {
        const viewer = context.facade.getPdfViewer();
        if (viewer) {
          viewer.currentPageNumber = toIntegerPageNumber(targetPage, state.doc.numPages);
        }
      });
    }

    if (context.container) {
      const viewer = context.facade.getPdfViewer();
      const scaleContext: ScaleContext = {
        container: context.container,
        doc: state.doc,
        viewer,
        stickToPage: state.stickToPage,
        onError: context.onError ?? (() => {}),
      };
      context.scaleService.updateScaleAndRender(
        context.facade,
        scaleContext,
        state.scale,
        targetPage,
      );
    }

    context.onHandTool(state.enableHandTool);
  }
}
