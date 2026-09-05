import { Injectable } from '@angular/core';
import type { InitContext, PdfViewerOptions, ViewerSyncState } from '../../core/models/viewer.model';
import { toPdfViewerError } from '../../core/models/viewer-error.model';
import type { PdfViewerFacadeService } from './viewer-facade.service';

/** Handles viewer lifecycle: initialization and reconfiguration. */
@Injectable()
export class PdfViewerLifecycleService {
  async initialize(facade: PdfViewerFacadeService, context: InitContext): Promise<void> {
    await facade.initialize(context.pdfjsBundle, context.container, context.options, context.events);
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
    extraOptions: Pick<PdfViewerOptions, 'showBorders' | 'externalLinkTarget' | 'locale'>,
    onComplete: () => void,
    onError: (err: Error) => void,
  ): Promise<void> {
    try {
      const options: PdfViewerOptions = { ...config, ...extraOptions };
      await facade.reconfigure(pdfjsBundle, container, options);
    } catch (err) {
      onError(toPdfViewerError(err));
      onComplete();
      return;
    }

    const doc = facade.currentDocument();
    if (!doc) {
      onComplete();
      return;
    }

    try {
      // Wire the document through the full bridge path so the freshly created
      // link service, find controller, and viewer all receive it. Calling only
      // viewer.setDocument would leave the new find controller without the
      // document, so search results could never surface as highlights.
      facade.setDocument(doc);
      const viewer = facade.getPdfViewer();
      if (viewer.firstPagePromise) await viewer.firstPagePromise;
    } catch (err) {
      onError(toPdfViewerError(err));
    }
    onComplete();
  }
}
