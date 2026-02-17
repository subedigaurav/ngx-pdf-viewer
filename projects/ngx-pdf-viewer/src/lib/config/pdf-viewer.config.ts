import { InjectionToken } from '@angular/core';
import { DEFAULT_CDN_BASE, DEFAULT_VERSION } from '../constants/pdf-viewer.constants';
import type { PdfViewerConfig } from '../models/pdf-viewer.model';

/**
 * Injection token for PDF viewer configuration
 */
export const PDF_VIEWER_CONFIG = new InjectionToken<PdfViewerConfig>('PDF_VIEWER_CONFIG', {
  providedIn: 'root',
  factory: () => ({
    version: DEFAULT_VERSION,
    cdnBase: DEFAULT_CDN_BASE,
    enableHandTool: false,
  }),
});

/**
 * Provides PDF viewer configuration.
 * Use in app config or component providers.
 *
 * @example
 * ```typescript
 * // In app.config.ts
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     providePdfViewerConfig({
 *       version: '5.4.624',
 *       enableHandTool: true,
 *     }),
 *   ],
 * };
 * ```
 *
 * @param config - Partial configuration object
 * @returns Provider configuration
 */
export function providePdfViewerConfig(config: Partial<PdfViewerConfig>) {
  return {
    provide: PDF_VIEWER_CONFIG,
    useValue: {
      version: config.version ?? DEFAULT_VERSION,
      cdnBase: config.cdnBase ?? DEFAULT_CDN_BASE,
      ...config,
    },
  };
}

/**
 * Checks if the current environment is Server-Side Rendering (SSR)
 * @returns `true` if running in SSR, `false` if running in browser
 */
export function isSSR(): boolean {
  return typeof window === 'undefined' || typeof document === 'undefined';
}
