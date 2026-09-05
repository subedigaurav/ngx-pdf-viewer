import type { PDFDocumentLoadingTask, PDFDocumentParameters } from './pdf-document.model';

export interface GlobalWorkerOptions {
  workerPort?: unknown;
  workerSrc?: string;
}

export interface PDFJsLib {
  version: string;
  build: string;
  getDocument(params: string | Uint8Array | PDFDocumentParameters): PDFDocumentLoadingTask;
  GlobalWorkerOptions: GlobalWorkerOptions;
  PDFWorker: new (params?: { name?: string; port?: unknown; verbosity?: number }) => unknown;
  PDFDataRangeTransport: new (length: number, initialData: Uint8Array) => unknown;
  PasswordResponses: {
    NEED_PASSWORD: number;
    INCORRECT_PASSWORD: number;
  };
  InvalidPDFException: new (message: string) => Error;
  /**
   * pdf.js 6 collapsed `MissingPDFException` and `UnexpectedResponseException`
   * into this single class; neither of the old names exists on the module any
   * more. `missing` is true for a 404-style absent document.
   */
  ResponseException: new (
    message: string,
    status: number,
    missing: boolean,
  ) => Error & {
    status: number;
    missing: boolean;
  };
}

export interface LinkTarget {
  NONE: number;
  SELF: number;
  BLANK: number;
  PARENT: number;
  TOP: number;
}

/**
 * pdf.js's EventBus — not an EventTarget: it keeps its own listener map and
 * hands listeners the raw payload, so keys like `type` are ordinary data.
 */
export interface EventBus {
  // `any`, not `unknown`: required to satisfy rxjs fromEvent's
  // JQueryStyleEventEmitter overload, which is how the bus is subscribed.
  on(eventName: string, listener: (event: any) => void): void;
  off(eventName: string, listener: (event: any) => void): void;
  dispatch(eventName: string, data?: unknown): void;
}

export interface PDFLinkService {
  eventBus: EventBus;
  externalLinkTarget: number | null;
  externalLinkRel: string;
  externalLinkEnabled: boolean;
  setDocument(pdfDocument: unknown, baseUrl?: string | null): void;
  setViewer(pdfViewer: unknown): void;
  setHistory(pdfHistory: unknown): void;
  navigateTo(dest: unknown): void;
  getDestinationHash(dest: unknown): string;
  getAnchorUrl(hash: string): string;
  setHash(hash: string): void;
  executeNamedAction(action: string): void;
  cachePageRef(pageNum: number, pageRef: unknown): void;
  isPageVisible(pageNumber: number): boolean;
}

export interface PDFFindController {
  executeCommand(command: string, state: unknown): void;
  setDocument(pdfDocument: unknown): void;
}

export interface PDFViewer {
  container: HTMLDivElement;
  eventBus: EventBus;
  linkService: PDFLinkService;
  findController?: PDFFindController;
  currentPageNumber: number;
  currentScale: number | string;
  pagesRotation: number;
  firstPagePromise: Promise<unknown>;
  _pages: unknown[];
  _currentPageNumber: number;
  setDocument(pdfDocument: unknown): void;
  scrollPageIntoView(params: {
    pageNumber: number;
    destArray?: unknown;
    allowNegativeOffset?: boolean;
    ignoreDestinationZoom?: boolean;
  }): void;
  forceRendering(currentlyVisiblePages?: unknown): boolean;
  cleanup(): void;
  update(): void;
}

export interface PDFJsViewer {
  EventBus: new () => EventBus;
  PDFLinkService: new (config: {
    eventBus: EventBus;
    externalLinkTarget?: number;
    externalLinkRel?: string;
    externalLinkEnabled?: boolean;
  }) => PDFLinkService;
  PDFFindController: new (config: { eventBus: EventBus; linkService: PDFLinkService }) => PDFFindController;
  PDFViewer: new (config: PDFViewerConstructorOptions) => PDFViewer;
  PDFSinglePageViewer: new (config: PDFViewerConstructorOptions) => PDFViewer;
  GenericL10n: new (locale: string) => unknown;
  LinkTarget?: LinkTarget;
}

export interface PDFViewerConstructorOptions {
  container: HTMLDivElement;
  viewer?: HTMLDivElement;
  eventBus: EventBus;
  linkService?: PDFLinkService;
  findController?: PDFFindController;
  renderer?: string;
  textLayerMode?: number;
  annotationMode?: number;
  annotationEditorMode?: number;
  enableAutoLinking?: boolean;
  annotationEditorHighlightColors?: unknown;
  enablePrintAutoRotate?: boolean;
  imageResourcesPath?: string;
  removePageBorders?: boolean;
  useOnlyCssZoom?: boolean;
  maxCanvasPixels?: number;
  l10n?: unknown;
}

export interface PDFJsBundle {
  lib: PDFJsLib;
  viewer: PDFJsViewer;
  AnnotationMode?: {
    DISABLE: number;
    ENABLE: number;
    ENABLE_FORMS: number;
    ENABLE_STORAGE: number;
  };
  AnnotationEditorType?: {
    DISABLE: number;
  };
}
