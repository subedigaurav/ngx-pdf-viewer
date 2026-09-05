export type PdfViewerErrorCode =
  'LOAD_FAILED' | 'PASSWORD_REQUIRED' | 'PASSWORD_CANCELLED' | 'INVALID_SOURCE' | 'INVALID_STATE' | 'RENDER_FAILED';

export class PdfViewerError extends Error {
  override name = 'PdfViewerError';
  constructor(
    readonly code: PdfViewerErrorCode,
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
  }
}

export function toPdfViewerError(err: unknown): PdfViewerError {
  if (err instanceof PdfViewerError) return err;
  const name = err instanceof Error ? err.name : '';
  if (name === 'PasswordException') {
    return new PdfViewerError('PASSWORD_REQUIRED', err instanceof Error ? err.message : String(err), err);
  }
  const msg = err instanceof Error ? err.message : String(err);
  return new PdfViewerError('LOAD_FAILED', msg || 'Failed to load PDF document.', err);
}
