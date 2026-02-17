import { inject, Injectable } from '@angular/core';
import { isSSR, PDF_VIEWER_CONFIG } from '../config/pdf-viewer.config';
import { DEFAULT_CDN_BASE, DEFAULT_VERSION } from '../constants/pdf-viewer.constants';
import type { PDFJsBundle, PDFJsLib, PDFJsViewer } from '../models/pdfjs-api.model';

/**
 * Service responsible for dynamically loading PDF.js library.
 * Attempts to load from local node_modules first, then falls back to CDN.
 *
 * @Injectable({ providedIn: 'root' })
 */
@Injectable({ providedIn: 'root' })
export class PdfjsLoaderService {
  private readonly config = inject(PDF_VIEWER_CONFIG, { optional: true });
  private loadPromise: Promise<PDFJsBundle> | null = null;

  /**
   * Loads the PDF.js library bundle (lib + viewer).
   * Caches the result for subsequent calls.
   *
   * @param version - Optional version override
   * @returns Promise resolving to the PDF.js bundle
   * @throws Error if PDF.js cannot be loaded or if running in SSR
   */
  async load(version?: string): Promise<PDFJsBundle> {
    if (isSSR()) {
      throw new Error(
        'ngx-pdf-viewer: PDF.js cannot be loaded in Server-Side Rendering environment. ' +
          'Ensure this component is only rendered in the browser.',
      );
    }

    // Return cached promise if already loading/loaded
    if (this.loadPromise) {
      return this.loadPromise;
    }

    const targetVersion = version ?? this.config?.version ?? DEFAULT_VERSION;
    this.loadPromise = this.loadPdfJsBundle(targetVersion);
    return this.loadPromise;
  }

  /**
   * Attempts to load PDF.js bundle from multiple sources
   */
  private async loadPdfJsBundle(version: string): Promise<PDFJsBundle> {
    let lastError: unknown = null;

    // Strategy 1: Try loading from local node_modules
    const localResult = await this.tryLoadLocal();
    if (localResult.bundle) {
      this.configureWorker(localResult.bundle.lib, version);
      return localResult.bundle;
    }
    if (localResult.error) lastError = localResult.error;

    // Strategy 2: Load from CDN
    const cdnResult = await this.tryLoadFromCdn(version);
    if (cdnResult.bundle) {
      this.configureWorker(cdnResult.bundle.lib, version);
      return cdnResult.bundle;
    }
    if (cdnResult.error) lastError = cdnResult.error;

    // Both strategies failed
    throw this.createLoadError(version, lastError);
  }

  /**
   * Attempts to load PDF.js from local node_modules installation.
   * Loads lib before viewer since pdf_viewer.mjs expects globalThis.pdfjsLib.
   */
  private async tryLoadLocal(): Promise<{ bundle: PDFJsBundle | null; error?: unknown }> {
    const attempts: Array<[string, string]> = [
      ['pdfjs-dist', 'pdfjs-dist/web/pdf_viewer.mjs'],
      ['pdfjs-dist/build/pdf.mjs', 'pdfjs-dist/web/pdf_viewer.mjs'],
    ];

    let lastError: unknown = null;
    for (const [libPath, viewerPath] of attempts) {
      try {
        const pdfjsLibModule = await import(/* webpackIgnore: true */ libPath);
        const pdfjsViewerModule = await import(/* webpackIgnore: true */ viewerPath);

        return { bundle: this.extractBundle(pdfjsLibModule, pdfjsViewerModule) };
      } catch (err) {
        lastError = err;
      }
    }
    return { bundle: null, error: lastError };
  }

  /**
   * Attempts to load PDF.js from CDN.
   * Must load lib before viewer: pdf_viewer.mjs expects globalThis.pdfjsLib set by pdf.mjs.
   */
  private async tryLoadFromCdn(
    version: string,
  ): Promise<{ bundle: PDFJsBundle | null; error?: unknown }> {
    try {
      const cdnBase = this.config?.cdnBase ?? DEFAULT_CDN_BASE;
      const libUrl = `${cdnBase}@${version}/build/pdf.mjs`;
      const viewerUrl = `${cdnBase}@${version}/web/pdf_viewer.mjs`;

      // Load lib first so it sets globalThis.pdfjsLib before viewer runs
      const pdfjsLibModule = await import(/* @vite-ignore */ /* webpackIgnore: true */ libUrl);
      const pdfjsViewerModule = await import(
        /* @vite-ignore */ /* webpackIgnore: true */ viewerUrl
      );

      return { bundle: this.extractBundle(pdfjsLibModule, pdfjsViewerModule) };
    } catch (err) {
      return { bundle: null, error: err };
    }
  }

  /**
   * Extracts the PDF.js bundle from dynamic import results
   */
  private extractBundle(libModule: unknown, viewerModule: unknown): PDFJsBundle {
    const lib = this.extractDefault<PDFJsLib>(libModule);
    const viewer = this.extractDefault<PDFJsViewer>(viewerModule);

    // Extract AnnotationEditorType if available
    const AnnotationEditorType = (libModule as { AnnotationEditorType?: { DISABLE: number } })
      .AnnotationEditorType;

    return { lib, viewer, AnnotationEditorType };
  }

  /**
   * Extracts the default export or returns the module itself
   */
  private extractDefault<T>(module: unknown): T {
    const mod = module as { default?: T };
    return mod.default ?? (module as T);
  }

  /**
   * Configures the PDF.js worker
   */
  private configureWorker(lib: PDFJsLib, version: string): void {
    if (this.config?.workerSrc) {
      lib.GlobalWorkerOptions.workerSrc = this.config.workerSrc;
    } else {
      const cdnBase = this.config?.cdnBase ?? DEFAULT_CDN_BASE;
      lib.GlobalWorkerOptions.workerSrc = `${cdnBase}@${version}/legacy/build/pdf.worker.min.mjs`;
    }
  }

  /**
   * Creates a detailed error message for load failures
   */
  private createLoadError(version: string, cause?: unknown): Error {
    const cdnBase = this.config?.cdnBase ?? DEFAULT_CDN_BASE;
    const causeMsg = cause instanceof Error ? cause.message : cause ? String(cause) : '';
    const detail = causeMsg ? `\n\nLast error: ${causeMsg}` : '';

    return new Error(
      `ngx-pdf-viewer: Failed to load PDF.js library.\n\n` +
        `Attempted strategies:\n` +
        `1. Local installation (npm install pdfjs-dist)\n` +
        `2. CDN loading from ${cdnBase}@${version}\n\n` +
        `Solutions:\n` +
        `- Run: npm install pdfjs-dist (or pnpm add pdfjs-dist)\n` +
        `- Ensure pdfjs-dist is in your dependencies, not just devDependencies\n` +
        `- Or add to index.html: <script src="${cdnBase}@${version}/build/pdf.mjs" type="module"></script>\n` +
        `- Or configure a custom CDN base using providePdfViewerConfig()` +
        detail,
    );
  }

  /**
   * Resets the cached load promise (useful for testing)
   */
  reset(): void {
    this.loadPromise = null;
  }
}
