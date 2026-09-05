import { isSSR } from '../config/viewer-config';
import type { PDFJsLib } from '../models/pdfjs-api.model';
import type { PdfViewerConfig } from '../models/viewer.model';

/** pdfjs-dist version this library's hand-typed API surface was written against. */
export const PDFJS_VERSION = '6.3.289';

const DEFAULT_CDN_BASE_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/`;

type CdnConfig = Pick<PdfViewerConfig, 'cdnBaseUrl'>;

/**
 * Resolves the CDN root every other default URL hangs off, always with a
 * trailing slash — pdf.js concatenates filenames onto these bases directly
 * (`${wasmUrl}qcms_bg.wasm`), so a missing slash silently produces 404s.
 */
export function resolveCdnBaseUrl(config?: CdnConfig): string {
  const base = config?.cdnBaseUrl?.trim() || DEFAULT_CDN_BASE_URL;
  return base.endsWith('/') ? base : `${base}/`;
}

/** Default worker URL, pinned to {@link PDFJS_VERSION}. */
export function resolveDefaultWorkerSrc(config?: CdnConfig): string {
  return `${resolveCdnBaseUrl(config)}build/pdf.worker.min.mjs`;
}

/** Default CMap URL for CJK text rendering. */
export function resolveDefaultCMapsUrl(config?: CdnConfig): string {
  return `${resolveCdnBaseUrl(config)}cmaps/`;
}

/** Default standard-fonts URL, used for the 14 standard PDF fonts. */
export function resolveDefaultStandardFontDataUrl(config?: CdnConfig): string {
  return `${resolveCdnBaseUrl(config)}standard_fonts/`;
}

/**
 * Default URL for pdf.js's WebAssembly decoders (OpenJPEG for JPEG 2000, JBIG2,
 * and QCMS for colour management). pdf.js has no fallback for this: left unset
 * it warns and those images fail to decode, so it is a default, not an extra.
 */
export function resolveDefaultWasmUrl(config?: CdnConfig): string {
  return `${resolveCdnBaseUrl(config)}wasm/`;
}

/** Default URL for the bundled ICC profile pdf.js uses for CMYK colour spaces. */
export function resolveDefaultIccUrl(config?: CdnConfig): string {
  return `${resolveCdnBaseUrl(config)}iccs/`;
}

/**
 * Sets GlobalWorkerOptions.workerSrc exactly once per app lifetime. Cross-origin
 * URLs (the CDN default included) are handled by pdf.js itself: it wraps the
 * worker in a same-origin blob shim that imports the real URL from inside the
 * worker, working around the same-origin restriction on `new Worker()`.
 */
export function ensureWorkerConfigured(lib: PDFJsLib, config?: PdfViewerConfig): void {
  if (isSSR()) return;
  if (lib.GlobalWorkerOptions.workerSrc || lib.GlobalWorkerOptions.workerPort) return;
  lib.GlobalWorkerOptions.workerSrc = config?.workerSrc ?? resolveDefaultWorkerSrc(config);
}

const STYLESHEET_MARKER = 'data-ngx-pdf-viewer-style';

/**
 * Injects pdf.js's own stylesheet (required for text/annotation layer
 * positioning), once per app lifetime.
 *
 * Prepended rather than appended: pdf_viewer.css declares generic `:root`
 * custom properties and `color-scheme`, so injecting it last would let vendor
 * CSS outrank the host application's own equally-specific rules. First in
 * `<head>` keeps the host's styles authoritative.
 */
export function ensureStylesheetLoaded(config?: CdnConfig): Promise<void> {
  if (isSSR()) return Promise.resolve();
  if (document.querySelector(`[${STYLESHEET_MARKER}]`)) return Promise.resolve();

  const href = `${resolveCdnBaseUrl(config)}web/pdf_viewer.css`;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.setAttribute(STYLESHEET_MARKER, '');

  return new Promise((resolve) => {
    link.onload = () => resolve();
    link.onerror = () => {
      console.warn(
        `ngx-pdf-viewer: could not load pdf.js's stylesheet from ${href}. ` +
          'Text and annotation layers will be mispositioned. Check network access or ' +
          'your Content-Security-Policy `style-src`, or self-host it via `cdnBaseUrl`.',
      );
      resolve();
    };
    document.head.prepend(link);
  });
}
