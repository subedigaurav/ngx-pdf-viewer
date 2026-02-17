/**
 * PDF Viewer models and configuration types
 */

import type { PDFDocumentProxy } from './pdf-document.model';
import type { PDFJsBundle, PDFViewer } from './pdfjs-api.model';

export type ZoomScale = 'page-height' | 'page-fit' | 'page-width';
export type ExternalLinkTarget = 'blank' | 'none' | 'self' | 'parent' | 'top';

export enum RenderTextMode {
  DISABLED = 0,
  ENABLED = 1,
  ENHANCED = 2,
}

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
  };
  page: number;
  stickToPage: boolean;
  enableHandTool: boolean;
}

/** Configuration for PDF.js loading and viewer behavior */
export interface PdfViewerConfig {
  version?: string;
  cdnBase?: string;
  workerSrc?: string;
  cMapsUrl?: string | null;
  imageResourcesPath?: string;
  enableHandTool?: boolean;
}

/** Context required for scale operations */
export interface ScaleContext {
  container: HTMLDivElement;
  doc: PDFDocumentProxy;
  viewer: PDFViewer;
  stickToPage: boolean;
  onError: (err: Error) => void;
}

/** Configuration for initializing the PDF viewer bridge */
export interface PdfViewerBridgeConfig {
  container: HTMLDivElement;
  renderText: boolean;
  renderTextMode: RenderTextMode;
  showBorders: boolean;
  externalLinkTarget: ExternalLinkTarget;
  imageResourcesPath?: string;
}

/** Context for viewer initialization */
export interface InitContext {
  container: HTMLDivElement;
  pdfjsBundle: PDFJsBundle;
  options: PdfViewerOptions;
  events: PdfViewerEvents;
}

/** Sync state with tracking for change detection */
export interface SyncStateTracker {
  lastReconfigureKey: string;
  lastEmittedDoc: PDFDocumentProxy | null;
  getLatestScrolledPage: () => number;
  setLatestScrolledPage: (page: number) => void;
}

/** Hand tool cleanup function */
export type HandToolCleanup = () => void;
