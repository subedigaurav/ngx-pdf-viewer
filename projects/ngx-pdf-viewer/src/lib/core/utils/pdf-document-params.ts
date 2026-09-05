import type { DocumentParamsInput, PDFDocumentParameters, PDFSource } from '../models/pdf-document.model';

export function buildDocumentParams({
  src,
  cMapsUrl,
  standardFontDataUrl,
  wasmUrl,
  iccUrl,
  enableXfa = true,
}: DocumentParamsInput): PDFDocumentParameters {
  if (!src) throw new Error('PDF source is required');

  const baseParams: PDFDocumentParameters = {
    cMapUrl: cMapsUrl ?? undefined,
    cMapPacked: true,
    standardFontDataUrl: standardFontDataUrl ?? undefined,
    wasmUrl: wasmUrl ?? undefined,
    iccUrl: iccUrl ?? undefined,
    enableXfa,
    isEvalSupported: false,
  };

  if (typeof src === 'string') return { ...baseParams, url: src };
  if (src instanceof Uint8Array || src instanceof ArrayBuffer) return { ...baseParams, data: src as Uint8Array };
  if (src instanceof URL) return { ...baseParams, url: src.toString() };
  // Defaults first: an explicit `cMapUrl` / `enableXfa` on a caller-supplied
  // parameters object must win, not be overwritten by the derived defaults.
  return { ...baseParams, ...(src as PDFDocumentParameters) };
}

export function isValidPdfSource(value: unknown): value is PDFSource {
  if (!value) return false;

  const type = typeof value;
  if (type === 'string' || value instanceof Uint8Array || value instanceof ArrayBuffer || value instanceof URL)
    return true;

  if (type === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    return 'url' in obj || 'data' in obj || 'range' in obj;
  }
  return false;
}
