/**
 * PDF.js document models with proper typing
 */

export interface PDFPageViewport {
  width: number;
  height: number;
  scale: number;
  rotation: number;
}

export interface PDFPageProxy {
  pageNumber: number;
  rotate: number;
  view: [number, number, number, number];
  getViewport(params: { scale: number; rotation?: number }): PDFPageViewport;
  render(params: unknown): { promise: Promise<void>; cancel: () => void };
  getTextContent(): Promise<unknown>;
  cleanup(): void;
}

export interface PDFDocumentProxy {
  numPages: number;
  fingerprints: [string, string | null];
  getPage(pageNumber: number): Promise<PDFPageProxy>;
  getMetadata(): Promise<{ info: Record<string, unknown>; metadata: unknown }>;
  getData(): Promise<Uint8Array>;
  destroy(): Promise<void>;
}

export interface PDFDocumentLoadingTask {
  readonly promise: Promise<PDFDocumentProxy>;
  readonly destroyed: boolean;
  onPassword?: (callback: (password: string) => void, reason: number) => void;
  onProgress?: (progressData: PDFProgressData) => void;
  destroy(): Promise<void>;
}

export interface PDFProgressData {
  loaded: number;
  total: number;
}

export interface PDFDataRangeTransport {
  length: number;
  initialData: Uint8Array;
  abort(): void;
  requestDataRange(begin: number, end: number): void;
}

export type PDFSource =
  | string
  | URL
  | Uint8Array
  | ArrayBuffer
  | PDFDocumentParameters
  | PDFDataRangeTransport;

/** Input parameters for building PDF.js document loading parameters */
export interface DocumentParamsInput {
  src: string | Uint8Array | PDFSource | undefined;
  cMapsUrl?: string | null;
  enableXfa?: boolean;
}

export interface PDFDocumentParameters {
  url?: string | URL;
  data?: Uint8Array | ArrayBuffer | number[];
  httpHeaders?: Record<string, string>;
  withCredentials?: boolean;
  password?: string;
  length?: number;
  range?: PDFDataRangeTransport;
  rangeChunkSize?: number;
  worker?: unknown;
  verbosity?: number;
  docBaseUrl?: string;
  cMapUrl?: string;
  cMapPacked?: boolean;
  CMapReaderFactory?: unknown;
  useSystemFonts?: boolean;
  standardFontDataUrl?: string;
  StandardFontDataFactory?: unknown;
  useWorkerFetch?: boolean;
  isEvalSupported?: boolean;
  isOffscreenCanvasSupported?: boolean;
  canvasMaxAreaInBytes?: number;
  disableFontFace?: boolean;
  fontExtraProperties?: boolean;
  enableXfa?: boolean;
  ownerDocument?: Document;
  disableRange?: boolean;
  disableStream?: boolean;
  disableAutoFetch?: boolean;
  pdfBug?: boolean;
}
