import { InjectionToken, type Provider } from '@angular/core';
import type { PdfViewerConfig } from '../models/viewer.model';

export const PDF_VIEWER_CONFIG = new InjectionToken<PdfViewerConfig>('PDF_VIEWER_CONFIG', {
  providedIn: 'root',
  factory: () => ({ enableHandTool: false }),
});

/**
 * Provides PDF viewer configuration. Use in app config or component providers.
 *
 * Every field is optional: pdf.js and all of its runtime resources resolve
 * against a pinned CDN by default, so this is only needed to self-host, point
 * at a different CDN, or change viewer behaviour.
 *
 * @example
 * ```typescript
 * // In app.config.ts
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     providePdfViewerConfig({
 *       cdnBaseUrl: '/assets/pdfjs/', // self-hosted mirror of the pdfjs-dist package
 *       enableHandTool: true,
 *     }),
 *   ],
 * };
 * ```
 *
 * @param config - Configuration overrides
 * @returns Provider for {@link PDF_VIEWER_CONFIG}
 */
export function providePdfViewerConfig(config: PdfViewerConfig): Provider {
  return { provide: PDF_VIEWER_CONFIG, useValue: { ...config } };
}

export function isSSR(): boolean {
  return typeof window === 'undefined' || typeof document === 'undefined';
}
