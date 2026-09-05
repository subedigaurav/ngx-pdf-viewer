import { Injectable, inject } from '@angular/core';
import { isSSR, PDF_VIEWER_CONFIG } from '../../core/config/viewer-config';
import type { PDFJsBundle, PDFJsLib, PDFJsViewer } from '../../core/models/pdfjs-api.model';
import { ensureStylesheetLoaded, ensureWorkerConfigured, resolveCdnBaseUrl } from '../../core/utils/pdf-worker';

/**
 * Loads pdf.js — core, viewer, and stylesheet — from a CDN, no host
 * `pdfjs-dist` install needed. URLs are runtime-computed template strings
 * rather than literals: bundlers only ever treat this as an opaque runtime
 * fetch this way, so it stays a separate, lazily-loaded chunk and never
 * affects the host's own build.
 *
 * Core/viewer load sequentially (pdf_viewer.mjs reads globalThis.pdfjsLib);
 * the stylesheet loads in parallel and is awaited before returning.
 */
@Injectable({ providedIn: 'root' })
export class PdfjsService {
  private readonly config = inject(PDF_VIEWER_CONFIG, { optional: true });
  private loadPromise: Promise<PDFJsBundle> | null = null;

  async load(): Promise<PDFJsBundle> {
    if (isSSR()) {
      throw new Error(
        'ngx-pdf-viewer: PDF.js cannot be initialized during SSR. ' +
          'Ensure the component renders only in the browser.',
      );
    }
    this.loadPromise ??= this.loadBundle().catch((error: unknown) => {
      this.loadPromise = null;
      throw error;
    });
    return this.loadPromise;
  }

  private async loadBundle(): Promise<PDFJsBundle> {
    const baseUrl = resolveCdnBaseUrl(this.config ?? undefined);
    const stylesheetLoaded = ensureStylesheetLoaded(this.config ?? undefined);

    const libModule = (await import(
      /* webpackIgnore: true */ /* @vite-ignore */ `${baseUrl}build/pdf.min.mjs`
    )) as Record<string, unknown>;
    const lib = extractDefault<PDFJsLib>(libModule);

    // pdf_viewer.mjs expects globalThis.pdfjsLib to exist when evaluated.
    (globalThis as { pdfjsLib?: unknown }).pdfjsLib ??= lib;

    const viewerModule = (await import(
      /* webpackIgnore: true */ /* @vite-ignore */ `${baseUrl}web/pdf_viewer.mjs`
    )) as Record<string, unknown>;
    const viewer = extractDefault<PDFJsViewer>(viewerModule);

    ensureWorkerConfigured(lib, this.config ?? undefined);
    await stylesheetLoaded;

    return {
      lib,
      viewer,
      AnnotationMode: libModule['AnnotationMode'] as PDFJsBundle['AnnotationMode'],
      AnnotationEditorType: libModule['AnnotationEditorType'] as PDFJsBundle['AnnotationEditorType'],
    };
  }
}

function extractDefault<T>(module: unknown): T {
  const mod = module as { default?: T };
  return mod.default ?? (module as T);
}
