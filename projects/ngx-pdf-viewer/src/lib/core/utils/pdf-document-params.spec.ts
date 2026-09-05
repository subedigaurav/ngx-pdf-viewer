import { describe, expect, it } from 'vitest';
import { buildDocumentParams, isValidPdfSource } from './pdf-document-params';

describe('buildDocumentParams', () => {
  it('throws when source is missing', () => {
    expect(() => buildDocumentParams({ src: '' })).toThrow(/required/i);
    expect(() => buildDocumentParams({ src: undefined as never })).toThrow(/required/i);
  });

  it('wraps a bare URL string and still applies the safe defaults', () => {
    const params = buildDocumentParams({ src: 'http://example.com/doc.pdf' }) as Record<string, unknown>;
    expect(params['url']).toBe('http://example.com/doc.pdf');
    expect(params['cMapUrl']).toBeUndefined();
    expect(params['cMapPacked']).toBe(true);
    expect(params['isEvalSupported']).toBe(false);
    expect(params['enableXfa']).toBe(true);
  });

  it('wraps a URL string into { url } and attaches cMap options', () => {
    const params = buildDocumentParams({
      src: 'http://example.com/doc.pdf',
      cMapsUrl: '/assets/cmaps/',
    }) as Record<string, unknown>;
    expect(params['url']).toBe('http://example.com/doc.pdf');
    expect(params['cMapUrl']).toBe('/assets/cmaps/');
    expect(params['cMapPacked']).toBe(true);
  });

  it('wraps Uint8Array into { data }', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const params = buildDocumentParams({
      src: bytes,
      cMapsUrl: '/assets/cmaps/',
    }) as Record<string, unknown>;
    expect(params['data']).toBe(bytes);
    expect(params['cMapPacked']).toBe(true);
  });

  it('passes object params through (merged with cMap options)', () => {
    const params = buildDocumentParams({
      src: { url: 'http://example.com/doc.pdf', withCredentials: true },
      cMapsUrl: '/assets/cmaps/',
    }) as Record<string, unknown>;
    expect(params['url']).toBe('http://example.com/doc.pdf');
    expect(params['withCredentials']).toBe(true);
    expect(params['isEvalSupported']).toBe(false);
  });

  it('lets explicit object params win over the defaults', () => {
    const params = buildDocumentParams({
      src: { url: 'http://example.com/doc.pdf', cMapUrl: '/custom/cmaps/', enableXfa: false },
      cMapsUrl: '/assets/cmaps/',
    } as never) as Record<string, unknown>;
    expect(params['cMapUrl']).toBe('/custom/cmaps/');
    expect(params['enableXfa']).toBe(false);
  });
});

describe('isValidPdfSource', () => {
  it('accepts http(s) URL strings', () => {
    expect(isValidPdfSource('http://example.com/doc.pdf')).toBe(true);
    expect(isValidPdfSource('https://example.com/doc.pdf')).toBe(true);
  });

  it('accepts binary sources, URL objects, and parameter objects', () => {
    expect(isValidPdfSource(new Uint8Array([1]))).toBe(true);
    expect(isValidPdfSource(new ArrayBuffer(4))).toBe(true);
    expect(isValidPdfSource(new URL('http://example.com/doc.pdf'))).toBe(true);
    expect(isValidPdfSource({ url: 'http://example.com/doc.pdf' })).toBe(true);
  });

  it('accepts any non-empty string, including file:// (scheme validation intentionally absent in v1)', () => {
    expect(isValidPdfSource('file:///x.pdf')).toBe(true);
    expect(isValidPdfSource('some-relative-path.pdf')).toBe(true);
  });

  it('rejects empty/nullish values and objects without url', () => {
    expect(isValidPdfSource('')).toBe(false);
    expect(isValidPdfSource(null)).toBe(false);
    expect(isValidPdfSource(undefined)).toBe(false);
    expect(isValidPdfSource(0)).toBe(false);
    expect(isValidPdfSource({})).toBe(false);
  });
});
