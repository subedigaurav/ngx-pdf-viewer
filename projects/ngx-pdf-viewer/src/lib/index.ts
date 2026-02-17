/**
 * ngx-pdf-viewer - Headless Angular PDF Viewer Library
 */
export { PdfViewerComponent } from './components/pdf-viewer.component';
export { isSSR, PDF_VIEWER_CONFIG, providePdfViewerConfig } from './config/pdf-viewer.config';
export type { PdfViewerConfig } from './models/pdf-viewer.model';
export {
  BORDER_WIDTH,
  CSS_UNITS,
  DEFAULT_CDN_BASE,
  DEFAULT_VERSION,
  PAGE_CHANGE_DEBOUNCE_TIME,
  RESIZE_DEBOUNCE_TIME,
  SCALE_INCREMENT,
} from './constants/pdf-viewer.constants';

export type {
  DocumentParamsInput,
  PDFDocumentLoadingTask,
  PDFDocumentParameters,
  PDFDocumentProxy,
  PDFPageProxy,
  PDFProgressData,
  PDFSource,
} from './models/pdf-document.model';

export {
  RenderTextMode,
  type ExternalLinkTarget,
  type HandToolCleanup,
  type PdfViewerOptions,
  type PdfViewerState,
  type ScaleCalculationParams,
  type ZoomScale,
} from './models/pdf-viewer.model';

export type {
  EventBus,
  PDFFindController,
  PDFJsBundle,
  PDFJsLib,
  PDFJsViewer,
  PDFLinkService,
  PDFViewer,
} from './models/pdfjs-api.model';

export type { PdfViewerBridgeConfig } from './models/pdf-viewer.model';
export { PdfViewerBridgeService } from './services/pdf-viewer-bridge.service';
export { PdfViewerFacadeService } from './services/pdf-viewer-facade.service';
export { PdfjsLoaderService } from './services/pdfjs-loader.service';

export { createEventBus } from './utils/event-bus.util';
export { setupHandTool } from './utils/hand-tool.util';
export { buildDocumentParams, isValidPdfSource } from './utils/pdf-document-params.util';
export {
  calculatePdfScale,
  normalizePageNumber,
  roundScaleToIncrement,
  toIntegerPageNumber,
} from './utils/pdf-scale.util';
