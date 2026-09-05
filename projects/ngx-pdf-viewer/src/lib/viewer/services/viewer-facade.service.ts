import { inject, Injectable, signal } from '@angular/core';
import { from, Observable } from 'rxjs';
import { isSSR, PDF_VIEWER_CONFIG } from '../../core/config/viewer-config';
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  PDFProgressData,
  PDFSource,
} from '../../core/models/pdf-document.model';
import { PdfViewerError, toPdfViewerError } from '../../core/models/viewer-error.model';
import {
  RenderTextMode,
  type PdfViewerBridgeConfig,
  type PdfViewerEvents,
  type PdfViewerOptions,
} from '../../core/models/viewer.model';
import type { PDFJsBundle } from '../../core/models/pdfjs-api.model';
import { buildDocumentParams, isValidPdfSource } from '../../core/utils/pdf-document-params';
import { toIntegerPageNumber } from '../../core/utils/pdf-scale';
import {
  resolveDefaultCMapsUrl,
  resolveDefaultIccUrl,
  resolveDefaultStandardFontDataUrl,
  resolveDefaultWasmUrl,
} from '../../core/utils/pdf-worker';
import { PdfViewerBridgeService } from './viewer-bridge.service';

/**
 * Facade service that orchestrates PDF loading, rendering, and lifecycle management.
 * Uses signals for state and DestroyRef for cleanup.
 */
@Injectable()
export class PdfViewerFacadeService {
  private readonly bridge = inject(PdfViewerBridgeService);
  private readonly config = inject(PDF_VIEWER_CONFIG, { optional: true });

  readonly currentDocument = signal<PDFDocumentProxy | null>(null);
  readonly loadError = signal<PdfViewerError | null>(null);
  readonly loadProgress = signal<PDFProgressData | null>(null);

  private currentLoadingTask: PDFDocumentLoadingTask | null = null;
  private lastLoadedSrcRef: unknown = null;
  private passwordAbort = false;

  private isSameSource(src: PDFSource): boolean {
    if (typeof src === 'string') return this.lastLoadedSrcRef === src;
    if (src instanceof Uint8Array) {
      return this.lastLoadedSrcRef === src;
    }
    return false;
  }

  /** Resolved CMap URL. Priority: component input > PDF_VIEWER_CONFIG > CDN default. */
  getCMapsUrl(inputOverride?: string | null): string {
    if (inputOverride !== null && inputOverride !== undefined) return inputOverride;
    return this.config?.cMapsUrl ?? resolveDefaultCMapsUrl(this.config ?? undefined);
  }

  /** Resolved standard-fonts URL. Priority: PDF_VIEWER_CONFIG > CDN default. */
  getStandardFontDataUrl(): string {
    return this.config?.standardFontDataUrl ?? resolveDefaultStandardFontDataUrl(this.config ?? undefined);
  }

  /** Resolved WebAssembly-decoder URL. Priority: PDF_VIEWER_CONFIG > CDN default. */
  getWasmUrl(): string {
    return this.config?.wasmUrl ?? resolveDefaultWasmUrl(this.config ?? undefined);
  }

  /** Resolved ICC-profile URL. Priority: PDF_VIEWER_CONFIG > CDN default. */
  getIccUrl(): string {
    return this.config?.iccUrl ?? resolveDefaultIccUrl(this.config ?? undefined);
  }

  /** Resolved hand-tool flag. Priority: component input > PDF_VIEWER_CONFIG > off. */
  getEnableHandTool(inputOverride?: boolean): boolean {
    return inputOverride ?? this.config?.enableHandTool ?? false;
  }

  getImageResourcesPath(): string | undefined {
    return this.config?.imageResourcesPath;
  }

  async initialize(
    pdfjsBundle: PDFJsBundle,
    container: HTMLDivElement,
    options: PdfViewerOptions,
    events: PdfViewerEvents,
  ): Promise<void> {
    if (isSSR()) return;

    const bridgeConfig: PdfViewerBridgeConfig = {
      container,
      renderText: options.renderText ?? true,
      renderTextMode: options.renderTextMode ?? RenderTextMode.ENABLED,
      showBorders: options.showBorders ?? false,
      externalLinkTarget: options.externalLinkTarget ?? 'blank',
      annotationMode: options.annotationMode ?? 1,
      locale: options.locale ?? 'en',
      imageResourcesPath: this.getImageResourcesPath(),
      maxCanvasPixels: this.config?.maxCanvasPixels,
    };

    this.bridge.initialize(pdfjsBundle.viewer, bridgeConfig, events);
  }

  async reconfigure(pdfjsBundle: PDFJsBundle, container: HTMLDivElement, options: PdfViewerOptions): Promise<void> {
    const bridgeConfig: PdfViewerBridgeConfig = {
      container,
      renderText: options.renderText ?? true,
      renderTextMode: options.renderTextMode ?? RenderTextMode.ENABLED,
      showBorders: options.showBorders ?? false,
      externalLinkTarget: options.externalLinkTarget ?? 'blank',
      annotationMode: options.annotationMode ?? 1,
      locale: options.locale ?? 'en',
      imageResourcesPath: this.getImageResourcesPath(),
      maxCanvasPixels: this.config?.maxCanvasPixels,
    };

    this.bridge.reconfigure(bridgeConfig);
  }

  /** Loads a PDF document from the specified source; cMapsUrl must already be resolved (see {@link getCMapsUrl}). */
  async loadDocument(
    src: PDFSource | undefined,
    cMapsUrl: string,
    pdfjsBundle: PDFJsBundle,
    passwordProvider?: (reason: number) => Promise<string | null>,
  ): Promise<void> {
    if (!src || !isValidPdfSource(src)) {
      this.loadError.set(new PdfViewerError('INVALID_SOURCE', 'Invalid PDF source'));
      return;
    }

    if (this.isSameSource(src) && this.currentDocument()) return;

    this.loadError.set(null);
    this.loadProgress.set(null);
    this.passwordAbort = false;

    try {
      await this.cleanup();

      const params = buildDocumentParams({
        src,
        cMapsUrl,
        standardFontDataUrl: this.getStandardFontDataUrl(),
        wasmUrl: this.getWasmUrl(),
        iccUrl: this.getIccUrl(),
      });
      const loadingTask = pdfjsBundle.lib.getDocument(params);
      this.currentLoadingTask = loadingTask;

      loadingTask.onProgress = (data: PDFProgressData) => this.loadProgress.set(data);

      const abortWithPasswordError = async (
        code: 'PASSWORD_REQUIRED' | 'PASSWORD_CANCELLED',
        message: string,
        cause?: unknown,
      ): Promise<void> => {
        // Mark the abort before destroying so the loadDocument catch block does
        // not overwrite the intentional password error when pdf.js rejects the
        // pending load promise in response to destroy().
        this.passwordAbort = true;
        this.currentLoadingTask = null;
        this.loadError.set(new PdfViewerError(code, message, cause));
        await loadingTask.destroy().catch(() => {});
      };

      loadingTask.onPassword = (callback: (password: string) => void, reason: number): void => {
        void (async () => {
          if (!passwordProvider) {
            await abortWithPasswordError(
              'PASSWORD_REQUIRED',
              'This PDF is password protected. Provide a passwordProvider input to unlock it.',
            );
            return;
          }
          let password: string | null;
          try {
            password = await passwordProvider(reason);
          } catch (err) {
            await abortWithPasswordError('PASSWORD_CANCELLED', 'Password prompt failed or was cancelled.', err);
            return;
          }
          if (password == null) {
            await abortWithPasswordError('PASSWORD_CANCELLED', 'Password prompt cancelled.');
            return;
          }
          try {
            callback(password);
          } catch (err) {
            await abortWithPasswordError('PASSWORD_CANCELLED', 'Password prompt failed or was cancelled.', err);
          }
        })();
      };

      const document = await loadingTask.promise;
      this.currentDocument.set(document);
      this.lastLoadedSrcRef = src;
      this.loadProgress.set(null);

      this.bridge.setDocument(document);
    } catch (error) {
      if (this.passwordAbort) return;
      this.lastLoadedSrcRef = null;
      this.loadProgress.set(null);
      this.loadError.set(toPdfViewerError(error));
    }
  }

  getPage(pageNumber: number): Observable<PDFPageProxy> {
    const doc = this.currentDocument();
    if (!doc) throw new Error('No document loaded');

    return from(doc.getPage(toIntegerPageNumber(pageNumber, doc.numPages)));
  }

  getPdfViewer() {
    return this.bridge.pdfViewer;
  }

  /** Sets the PDF document in the viewer, link service, and find controller. */
  setDocument(document: PDFDocumentProxy | null): void {
    this.bridge.setDocument(document);
  }

  setCurrentPage(pageNumber: number): void {
    this.bridge.setCurrentPage(toIntegerPageNumber(pageNumber));
  }

  scrollToPage(pageNumber: number, ignoreZoom = false): void {
    this.bridge.scrollPageIntoView(toIntegerPageNumber(pageNumber), ignoreZoom);
  }

  forceRendering(): void {
    this.bridge.forceRendering();
  }

  /**
   * Navigates to an internal PDF destination, such as a table-of-contents entry.
   */
  navigateToDestination(destination: unknown): void {
    this.bridge.navigateToDestination(destination);
  }

  async cleanup(): Promise<void> {
    // Detach the viewer first so pdf.js cancels in-flight rendering before the
    // transport goes away.
    this.bridge.setDocument(null);

    // Destroying the loading task is what tears the document down —
    // PDFDocumentProxy has no destroy() in pdf.js 6, only cleanup().
    // Swallowed: this runs on the path to loading the next document.
    const task = this.currentLoadingTask;
    this.currentLoadingTask = null;
    if (task && !task.destroyed) await task.destroy().catch(() => {});

    this.loadProgress.set(null);
    this.currentDocument.set(null);
    this.lastLoadedSrcRef = null;
  }
}
