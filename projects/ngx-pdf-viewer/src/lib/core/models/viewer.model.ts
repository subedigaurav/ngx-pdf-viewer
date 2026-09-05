import type { PDFDocumentProxy } from './pdf-document.model';
import type { PDFJsBundle, PDFViewer } from './pdfjs-api.model';

export type ZoomScale = 'page-height' | 'page-fit' | 'page-width';
export type ExternalLinkTarget = 'blank' | 'none' | 'self' | 'parent' | 'top';

export enum RenderTextMode {
  DISABLED = 0,
  ENABLED = 1,
  ENHANCED = 2,
}

export type AnnotationDisplayMode = 'none' | 'enabled' | 'forms' | 'storage';

export interface PdfViewerOptions {
  src?: string | Uint8Array | Record<string, unknown>;
  page?: number;
  renderText?: boolean;
  renderTextMode?: RenderTextMode;
  originalSize?: boolean;
  stickToPage?: boolean;
  zoom?: number;
  zoomScale?: ZoomScale;
  rotation?: number;
  autoresize?: boolean;
  fitToPage?: boolean;
  showBorders?: boolean;
  cMapsUrl?: string | null;
  externalLinkTarget?: ExternalLinkTarget;
  locale?: string;
  annotationMode?: number;
}

export interface PdfViewerState {
  isLoading: boolean;
  isInitialized: boolean;
  isVisible: boolean;
  currentPage: number;
  totalPages: number;
  error: Error | null;
}

export interface ScaleCalculationParams {
  viewportWidth: number;
  viewportHeight: number;
  containerWidth: number;
  containerHeight: number;
  zoom: number;
  zoomScale: ZoomScale;
  showBorders: boolean;
}

export interface PdfViewerEvents {
  pageRendered: (event: CustomEvent) => void;
  pagesInitialized: (event: CustomEvent) => void;
  textLayerRendered: (event: CustomEvent) => void;
  pageChanging: (pageNumber: number) => void;
  searchMatchesChange: (matches: PdfSearchMatches | null) => void;
}

/** Aggregated state for viewer sync - used to reduce effect count */
export interface ViewerSyncState {
  doc: PDFDocumentProxy;
  scale: {
    zoom: number;
    zoomScale: ZoomScale;
    rotation: number;
    originalSize: boolean;
    fitToPage: boolean;
    showBorders: boolean;
  };
  reconfigure: {
    renderText: boolean;
    renderTextMode: RenderTextMode;
    annotationMode: number;
  };
  page: number;
  stickToPage: boolean;
  enableHandTool: boolean;
}

/** Configuration for PDF.js loading and viewer behavior. pdf.js loads from a CDN by default — see Getting Started. */
export interface PdfViewerConfig {
  /** Overrides the default CDN base URL (e.g. cdnjs, unpkg, or a self-hosted mirror). */
  cdnBaseUrl?: string;
  /** Override the PDF.js worker URL (rarely needed; defaults to the CDN's). */
  workerSrc?: string;
  /** Override the CMap URL for CJK text rendering (rarely needed; defaults to the CDN's). */
  cMapsUrl?: string | null;
  /** Override the standard-fonts URL (rarely needed; defaults to the CDN's). */
  standardFontDataUrl?: string | null;
  /**
   * Override the URL of pdf.js's WebAssembly decoders — OpenJPEG (JPEG 2000),
   * JBIG2 and QCMS (rarely needed; defaults to the CDN's). Without it pdf.js
   * cannot decode those images at all, so self-hosting means serving pdf.js's
   * `wasm/` directory alongside the other overrides.
   */
  wasmUrl?: string | null;
  /** Override the URL of pdf.js's CMYK ICC profile (rarely needed; defaults to the CDN's). */
  iccUrl?: string | null;
  /** Base path pdf.js resolves annotation-layer images against. */
  imageResourcesPath?: string;
  /** Default for the component's `[enableHandTool]` input, which still wins when bound. */
  enableHandTool?: boolean;
  /**
   * Maximum canvas area (in pixels) pdf.js will render a page at.
   *
   * Leave this unset unless you have measured a problem. pdf.js already picks
   * a platform-aware default: 2**25 (33,554,432) on desktop, and 5,242,880 on
   * iOS/Android where canvas memory is scarce. Past the cap it renders at a
   * lower effective pixel ratio (a softer page) instead of allocating.
   *
   * Overriding raises the mobile cap too. Budget accordingly: one page canvas
   * at page-width zoom on a HiDPI display is already ~25 MB, and pdf.js keeps
   * up to 10 rendered pages buffered. Pass 0 to disable the cap entirely.
   */
  maxCanvasPixels?: number;
}

export interface ScaleContext {
  container: HTMLDivElement;
  doc: PDFDocumentProxy;
  viewer: PDFViewer;
  onError: (err: Error) => void;
}

export interface PdfViewerBridgeConfig {
  container: HTMLDivElement;
  renderText: boolean;
  renderTextMode: RenderTextMode;
  showBorders: boolean;
  externalLinkTarget: ExternalLinkTarget;
  annotationMode: number;
  locale: string;
  imageResourcesPath?: string;
  maxCanvasPixels?: number;
}

export interface InitContext {
  container: HTMLDivElement;
  pdfjsBundle: PDFJsBundle;
  options: PdfViewerOptions;
  events: PdfViewerEvents;
}

export interface SyncStateTracker {
  lastReconfigureKey: string;
  /**
   * Fingerprint of the last applied scale config, so the page echoes produced
   * by scrolling don't re-run the whole scale pipeline many times a second.
   */
  lastScaleKey: string;
  lastEmittedDoc: PDFDocumentProxy | null;
  getLatestScrolledPage: () => number;
  setLatestScrolledPage: (page: number) => void;
}

export type HandToolCleanup = () => void;

/** Options for text search delegation to the PDF.js find controller */
export interface SearchOptions {
  highlightAll?: boolean;
  caseSensitive?: boolean;
  entireWord?: boolean;
}

/** Current match position and total match count for an active search */
export interface PdfSearchMatches {
  current: number;
  total: number;
}

/** Rendered thumbnail data for a single PDF page */
export interface ThumbnailData {
  url: string;
  width: number;
  height: number;
}
