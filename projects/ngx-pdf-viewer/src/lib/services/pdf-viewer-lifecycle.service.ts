import { Injectable } from '@angular/core';
import type { InitContext, PdfViewerOptions, ViewerSyncState } from '../models/pdf-viewer.model';
import type { PdfViewerFacadeService } from './pdf-viewer-facade.service';

/**
 * Handles viewer lifecycle: initialization and reconfiguration.
 * Single responsibility: set up and reconfigure the PDF.js viewer.
 */
@Injectable()
export class PdfViewerLifecycleService {
  /**
   * Initializes the PDF viewer with the given context.
   */
  async initialize(facade: PdfViewerFacadeService, context: InitContext): Promise<void> {
    await facade.initialize(
      context.pdfjsBundle,
      context.container,
      context.options,
      context.events,
    );
  }

  /**
   * Reconfigures the viewer when renderText/renderTextMode change.
   * Calls onComplete when done so the caller can update scale.
   */
  async reconfigure(
    facade: PdfViewerFacadeService,
    pdfjsBundle: NonNullable<InitContext['pdfjsBundle']>,
    container: HTMLDivElement,
    config: ViewerSyncState['reconfigure'],
    extraOptions: Pick<PdfViewerOptions, 'showBorders' | 'externalLinkTarget'>,
    onComplete: () => void,
    onError: (err: Error) => void,
  ): Promise<void> {
    const options: PdfViewerOptions = { ...config, ...extraOptions };
    await facade.reconfigure(pdfjsBundle, container, options);

    const doc = facade.currentDocument();
    if (doc) {
      const viewer = facade.getPdfViewer();
      viewer.setDocument(doc as unknown);
      if (viewer.firstPagePromise) {
        viewer.firstPagePromise
          .then(onComplete)
          .catch((err) => onError(err instanceof Error ? err : new Error(String(err))));
      } else {
        onComplete();
      }
    }
  }
}
