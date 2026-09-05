import { describe, expect, it } from 'vitest';
import { PdfViewerError, toPdfViewerError } from './viewer-error.model';

describe('PdfViewerError', () => {
  it('carries a code and message', () => {
    const err = new PdfViewerError('LOAD_FAILED', 'boom');
    expect(err.code).toBe('LOAD_FAILED');
    expect(err.message).toBe('boom');
    expect(err.name).toBe('PdfViewerError');
    expect(err instanceof Error).toBe(true);
  });

  it('maps PasswordException to PASSWORD_REQUIRED', () => {
    const ex = new Error('bad password');
    ex.name = 'PasswordException';
    const mapped = toPdfViewerError(ex);
    expect(mapped.code).toBe('PASSWORD_REQUIRED');
  });

  it('wraps generic errors as LOAD_FAILED preserving cause', () => {
    const original = new Error('network down');
    const mapped = toPdfViewerError(original);
    expect(mapped.code).toBe('LOAD_FAILED');
    expect(mapped.cause).toBe(original);
  });

  it('wraps non-Error values', () => {
    const mapped = toPdfViewerError('weird failure');
    expect(mapped.code).toBe('LOAD_FAILED');
    expect(mapped.message).toContain('weird failure');
  });

  it('passes PdfViewerError through untouched', () => {
    const err = new PdfViewerError('INVALID_SOURCE', 'x');
    expect(toPdfViewerError(err)).toBe(err);
  });

  it('maps invalid sources explicitly', () => {
    expect(new PdfViewerError('INVALID_SOURCE', 'x').code).toBe('INVALID_SOURCE');
  });
});
