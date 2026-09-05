/**
 * ngx-pdf-viewer - Headless Angular PDF Viewer Library
 */

// Component + config
export { PdfViewerComponent } from './viewer/viewer-component';
export { isSSR, PDF_VIEWER_CONFIG, providePdfViewerConfig } from './core/config/viewer-config';
export { PdfjsService } from './viewer/services/viewer-pdfjs.service';

// Errors
export { PdfViewerError, toPdfViewerError } from './core/models/viewer-error.model';
export type { PdfViewerErrorCode } from './core/models/viewer-error.model';

// Models
export type {
  DocumentParamsInput,
  PDFDocumentLoadingTask,
  PDFDocumentMetadata,
  PDFDocumentParameters,
  PDFDocumentProxy,
  PDFPageProxy,
  PDFProgressData,
  PDFSource,
  PDFOutlineItem,
} from './core/models/pdf-document.model';
export {
  RenderTextMode,
  type AnnotationDisplayMode,
  type ExternalLinkTarget,
  type HandToolCleanup,
  type PdfSearchMatches,
  type PdfViewerOptions,
  type PdfViewerConfig,
  type ScaleCalculationParams,
  type SearchOptions,
  type ThumbnailData,
  type ZoomScale,
} from './core/models/viewer.model';
export type {
  EventBus,
  PDFFindController,
  PDFJsBundle,
  PDFJsLib,
  PDFJsViewer,
  PDFLinkService,
  PDFViewer,
} from './core/models/pdfjs-api.model';

// Constants
export {
  BORDER_WIDTH,
  CSS_UNITS,
  PAGE_CHANGE_DEBOUNCE_TIME,
  RESIZE_DEBOUNCE_TIME,
  SCALE_INCREMENT,
} from './core/constants/viewer-constants';

// Utils
export { createEventBus } from './core/utils/pdf-event-bus';
export { setupHandTool } from './core/utils/pdf-hand-tool';
export { buildDocumentParams, isValidPdfSource } from './core/utils/pdf-document-params';
export {
  calculatePdfScale,
  normalizePageNumber,
  roundScaleToIncrement,
  toIntegerPageNumber,
} from './core/utils/pdf-scale';
export {
  ensureStylesheetLoaded,
  ensureWorkerConfigured,
  PDFJS_VERSION,
  resolveCdnBaseUrl,
  resolveDefaultCMapsUrl,
  resolveDefaultIccUrl,
  resolveDefaultStandardFontDataUrl,
  resolveDefaultWasmUrl,
  resolveDefaultWorkerSrc,
} from './core/utils/pdf-worker';
export { renderPageThumbnail, THUMBNAIL_MAX_WIDTH } from './core/utils/pdf-thumbnail';
export { downloadBytes, printBytes } from './core/utils/pdf-file-actions';
