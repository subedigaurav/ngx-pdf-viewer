import type {
  DocumentParamsInput,
  PDFDocumentParameters,
  PDFSource,
} from '../models/pdf-document.model';

/**
 * Builds the parameters object for PDF.js getDocument() based on source type and configuration.
 *
 * @param input - Document loading parameters
 * @returns Formatted parameters for PDF.js getDocument()
 */
export function buildDocumentParams({
  src,
  cMapsUrl,
  enableXfa = true,
}: DocumentParamsInput): string | Uint8Array | PDFDocumentParameters {
  if (!src) throw new Error('PDF source is required');
  if (!cMapsUrl) return src as string | Uint8Array | PDFDocumentParameters;

  const baseParams: PDFDocumentParameters = {
    cMapUrl: cMapsUrl,
    cMapPacked: true,
    enableXfa,
    isEvalSupported: false,
  };

  if (typeof src === 'string') return { ...baseParams, url: src };
  if (src instanceof Uint8Array || src instanceof ArrayBuffer)
    return { ...baseParams, data: src as Uint8Array };
  return { ...(src as PDFDocumentParameters), ...baseParams };
}

/**
 * Checks if a value is a valid PDF source
 *
 * @param value - Value to check
 * @returns `true` if value is a valid PDF source
 */
export function isValidPdfSource(value: unknown): value is PDFSource {
  if (!value) return false;

  const type = typeof value;
  return (
    type === 'string' ||
    value instanceof Uint8Array ||
    value instanceof ArrayBuffer ||
    value instanceof URL ||
    (type === 'object' && (value as Record<string, unknown>)['url'] !== undefined)
  );
}
