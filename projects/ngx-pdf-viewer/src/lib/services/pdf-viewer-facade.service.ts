import { inject, Injectable, signal } from '@angular/core';
import { from, Observable } from 'rxjs';
import { isSSR, PDF_VIEWER_CONFIG } from '../config/pdf-viewer.config';
import { DEFAULT_CDN_BASE, DEFAULT_VERSION } from '../constants/pdf-viewer.constants';
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  PDFProgressData,
  PDFSource,
} from '../models/pdf-document.model';
import {
  RenderTextMode,
  type PdfViewerBridgeConfig,
  type PdfViewerEvents,
  type PdfViewerOptions,
} from '../models/pdf-viewer.model';
import { buildDocumentParams, isValidPdfSource } from '../utils/pdf-document-params.util';
import { toIntegerPageNumber } from '../utils/pdf-scale.util';
import { PdfViewerBridgeService } from './pdf-viewer-bridge.service';
import { PdfjsLoaderService } from './pdfjs-loader.service';

/**
 * Facade service that orchestrates PDF loading, rendering, and lifecycle management.
 * Uses signals for state and DestroyRef for cleanup.
 */
@Injectable()
export class PdfViewerFacadeService {
  private readonly bridge = inject(PdfViewerBridgeService);
  private readonly config = inject(PDF_VIEWER_CONFIG, { optional: true });

  readonly currentDocument = signal<PDFDocumentProxy | null>(null);
  readonly loadError = signal<Error | null>(null);
  readonly loadProgress = signal<PDFProgressData | null>(null);

  private currentLoadingTask: PDFDocumentLoadingTask | null = null;
  private lastLoadedSrc: PDFSource | null = null;

  /**
   * Gets the resolved CMap URL
   */
  getCMapsUrl(inputOverride?: string | null, pdfjsVersion?: string): string | null {
    if (inputOverride !== null && inputOverride !== undefined) return inputOverride;
    if (this.config?.cMapsUrl !== undefined) return this.config.cMapsUrl;

    const version = pdfjsVersion ?? this.config?.version ?? DEFAULT_VERSION;
    const cdnBase = this.config?.cdnBase ?? DEFAULT_CDN_BASE;
    return `${cdnBase}@${version}/cmaps/`;
  }

  /**
   * Gets the resolved image resources path
   */
  getImageResourcesPath(pdfjsVersion?: string): string {
    if (this.config?.imageResourcesPath) return this.config.imageResourcesPath;

    const version = pdfjsVersion ?? this.config?.version ?? DEFAULT_VERSION;
    const cdnBase = this.config?.cdnBase ?? DEFAULT_CDN_BASE;
    return `${cdnBase}@${version}/web/images/`;
  }

  /**
   * Initializes the PDF viewer with PDF.js components
   *
   * @param pdfjsBundle - Loaded PDF.js bundle
   * @param container - Container element
   * @param options - Viewer options
   * @param events - Event callbacks
   */
  async initialize(
    pdfjsBundle: Awaited<ReturnType<PdfjsLoaderService['load']>>,
    container: HTMLDivElement,
    options: PdfViewerOptions,
    events: PdfViewerEvents,
  ): Promise<void> {
    if (isSSR()) return;
    const pdfjsVersion = pdfjsBundle.lib.version;

    const bridgeConfig: PdfViewerBridgeConfig = {
      container,
      renderText: options.renderText ?? true,
      renderTextMode: options.renderTextMode ?? RenderTextMode.ENABLED,
      showBorders: options.showBorders ?? false,
      externalLinkTarget: options.externalLinkTarget ?? 'blank',
      imageResourcesPath: this.getImageResourcesPath(pdfjsVersion),
    };

    this.bridge.initialize(pdfjsBundle.viewer, bridgeConfig, events);
  }

  /**
   * Reconfigures the viewer (e.g., when switching between single/multi-page mode)
   */
  async reconfigure(
    pdfjsBundle: Awaited<ReturnType<PdfjsLoaderService['load']>>,
    container: HTMLDivElement,
    options: PdfViewerOptions,
  ): Promise<void> {
    const pdfjsVersion = pdfjsBundle.lib.version;

    const bridgeConfig: PdfViewerBridgeConfig = {
      container,
      renderText: options.renderText ?? true,
      renderTextMode: options.renderTextMode ?? RenderTextMode.ENABLED,
      showBorders: options.showBorders ?? false,
      externalLinkTarget: options.externalLinkTarget ?? 'blank',
      imageResourcesPath: this.getImageResourcesPath(pdfjsVersion),
    };

    this.bridge.reconfigure(bridgeConfig);
  }

  /**
   * Loads a PDF document from the specified source
   *
   * @param src - PDF source (URL, Uint8Array, or parameters object)
   * @param cMapsUrl - CMap URL for CJK fonts
   * @param pdfjsBundle - Loaded PDF.js bundle
   */
  async loadDocument(
    src: PDFSource | undefined,
    cMapsUrl: string | null,
    pdfjsBundle: Awaited<ReturnType<PdfjsLoaderService['load']>>,
  ): Promise<void> {
    if (!src || !isValidPdfSource(src)) {
      this.loadError.set(new Error('Invalid PDF source'));
      return;
    }

    if (this.lastLoadedSrc === src && this.currentDocument()) return;

    await this.cleanup();

    this.loadError.set(null);
    this.loadProgress.set(null);

    try {
      const params = buildDocumentParams({ src, cMapsUrl });
      const loadingTask = pdfjsBundle.lib.getDocument(params);
      this.currentLoadingTask = loadingTask;

      loadingTask.onProgress = (data: PDFProgressData) => this.loadProgress.set(data);

      const document = await loadingTask.promise;
      this.currentDocument.set(document);
      this.lastLoadedSrc = src;
      this.loadProgress.set(null);

      this.bridge.setDocument(document);
    } catch (error) {
      this.lastLoadedSrc = null;
      this.loadProgress.set(null);
      this.loadError.set(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Gets a specific page from the current document
   *
   * @param pageNumber - Page number to retrieve
   * @returns Observable of the page proxy
   */
  getPage(pageNumber: number): Observable<PDFPageProxy> {
    const doc = this.currentDocument();
    if (!doc) throw new Error('No document loaded');

    return from(doc.getPage(toIntegerPageNumber(pageNumber, doc.numPages)));
  }

  /**
   * Gets the current PDF viewer instance from the bridge
   */
  getPdfViewer() {
    return this.bridge.pdfViewer;
  }

  /**
   * Sets the current page in the viewer
   */
  setCurrentPage(pageNumber: number): void {
    this.bridge.setCurrentPage(toIntegerPageNumber(pageNumber));
  }

  /**
   * Scrolls to a specific page
   */
  scrollToPage(pageNumber: number, ignoreZoom = false): void {
    this.bridge.scrollPageIntoView(toIntegerPageNumber(pageNumber), ignoreZoom);
  }

  /**
   * Forces rendering of visible pages
   */
  forceRendering(): void {
    this.bridge.forceRendering();
  }

  /**
   * Cleans up the current document and loading task
   */
  async cleanup(): Promise<void> {
    if (this.currentLoadingTask && !this.currentLoadingTask.destroyed) {
      await this.currentLoadingTask.destroy();
      this.currentLoadingTask = null;
    }

    const doc = this.currentDocument();
    if (doc) await doc.destroy();

    this.loadProgress.set(null);
    this.currentDocument.set(null);
    this.bridge.setDocument(null);
    this.lastLoadedSrc = null;
  }
}
