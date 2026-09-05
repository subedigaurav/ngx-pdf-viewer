import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PDFJsLib } from '../models/pdfjs-api.model';
import {
  ensureStylesheetLoaded,
  ensureWorkerConfigured,
  PDFJS_VERSION,
  resolveCdnBaseUrl,
  resolveDefaultCMapsUrl,
  resolveDefaultIccUrl,
  resolveDefaultStandardFontDataUrl,
  resolveDefaultWasmUrl,
  resolveDefaultWorkerSrc,
} from './pdf-worker';

const DEFAULT_BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/`;

function createLib(overrides: Partial<PDFJsLib['GlobalWorkerOptions']> = {}): PDFJsLib {
  return { GlobalWorkerOptions: { ...overrides } } as PDFJsLib;
}

describe('resolveCdnBaseUrl', () => {
  it('defaults to the pinned jsDelivr build', () => {
    expect(resolveCdnBaseUrl()).toBe(DEFAULT_BASE);
    expect(resolveCdnBaseUrl({})).toBe(DEFAULT_BASE);
  });

  it('appends the trailing slash pdf.js concatenates filenames onto', () => {
    expect(resolveCdnBaseUrl({ cdnBaseUrl: 'https://example.com/pdfjs' })).toBe('https://example.com/pdfjs/');
    expect(resolveCdnBaseUrl({ cdnBaseUrl: 'https://example.com/pdfjs/' })).toBe('https://example.com/pdfjs/');
  });

  it('falls back to the default rather than resolving a blank override to the site root', () => {
    expect(resolveCdnBaseUrl({ cdnBaseUrl: '' })).toBe(DEFAULT_BASE);
    expect(resolveCdnBaseUrl({ cdnBaseUrl: '   ' })).toBe(DEFAULT_BASE);
  });
});

describe('default resource URLs', () => {
  it('point at every directory pdf.js fetches from at runtime', () => {
    expect(resolveDefaultWorkerSrc()).toBe(`${DEFAULT_BASE}build/pdf.worker.min.mjs`);
    expect(resolveDefaultCMapsUrl()).toBe(`${DEFAULT_BASE}cmaps/`);
    expect(resolveDefaultStandardFontDataUrl()).toBe(`${DEFAULT_BASE}standard_fonts/`);
    expect(resolveDefaultWasmUrl()).toBe(`${DEFAULT_BASE}wasm/`);
    expect(resolveDefaultIccUrl()).toBe(`${DEFAULT_BASE}iccs/`);
  });

  it('all follow a custom cdnBaseUrl', () => {
    const config = { cdnBaseUrl: 'https://unpkg.com/pdfjs-dist@6.3.289' };
    expect(resolveDefaultWorkerSrc(config)).toBe('https://unpkg.com/pdfjs-dist@6.3.289/build/pdf.worker.min.mjs');
    expect(resolveDefaultCMapsUrl(config)).toBe('https://unpkg.com/pdfjs-dist@6.3.289/cmaps/');
    expect(resolveDefaultStandardFontDataUrl(config)).toBe('https://unpkg.com/pdfjs-dist@6.3.289/standard_fonts/');
    expect(resolveDefaultWasmUrl(config)).toBe('https://unpkg.com/pdfjs-dist@6.3.289/wasm/');
    expect(resolveDefaultIccUrl(config)).toBe('https://unpkg.com/pdfjs-dist@6.3.289/iccs/');
  });
});

describe('ensureWorkerConfigured', () => {
  it('applies the CDN default when nothing is configured', () => {
    const lib = createLib();
    ensureWorkerConfigured(lib);
    expect(lib.GlobalWorkerOptions.workerSrc).toBe(`${DEFAULT_BASE}build/pdf.worker.min.mjs`);
  });

  it('prefers an explicit workerSrc over the CDN default', () => {
    const lib = createLib();
    ensureWorkerConfigured(lib, { workerSrc: '/assets/pdf.worker.min.mjs' });
    expect(lib.GlobalWorkerOptions.workerSrc).toBe('/assets/pdf.worker.min.mjs');
  });

  it('derives the worker from cdnBaseUrl when only that is set', () => {
    const lib = createLib();
    ensureWorkerConfigured(lib, { cdnBaseUrl: '/assets/pdfjs' });
    expect(lib.GlobalWorkerOptions.workerSrc).toBe('/assets/pdfjs/build/pdf.worker.min.mjs');
  });

  it('never overwrites a workerSrc or workerPort the host already set', () => {
    const withSrc = createLib({ workerSrc: '/existing.mjs' });
    ensureWorkerConfigured(withSrc, { workerSrc: '/ignored.mjs' });
    expect(withSrc.GlobalWorkerOptions.workerSrc).toBe('/existing.mjs');

    const port = {};
    const withPort = createLib({ workerPort: port });
    ensureWorkerConfigured(withPort);
    expect(withPort.GlobalWorkerOptions.workerSrc).toBeUndefined();
    expect(withPort.GlobalWorkerOptions.workerPort).toBe(port);
  });
});

describe('ensureStylesheetLoaded', () => {
  afterEach(() => {
    document.querySelectorAll('[data-ngx-pdf-viewer-style]').forEach((el) => el.remove());
    vi.restoreAllMocks();
  });

  it('injects pdf_viewer.css at the top of <head> so host CSS still wins', async () => {
    const existing = document.createElement('style');
    document.head.append(existing);

    const loaded = ensureStylesheetLoaded();
    const link = document.head.querySelector<HTMLLinkElement>('[data-ngx-pdf-viewer-style]');
    expect(link).not.toBeNull();
    expect(link?.rel).toBe('stylesheet');
    expect(link?.getAttribute('href')).toBe(`${DEFAULT_BASE}web/pdf_viewer.css`);
    expect(document.head.firstElementChild).toBe(link);

    link?.onload?.(new Event('load'));
    await expect(loaded).resolves.toBeUndefined();
    existing.remove();
  });

  it('injects only once per app lifetime', async () => {
    const first = ensureStylesheetLoaded();
    document.head.querySelector<HTMLLinkElement>('[data-ngx-pdf-viewer-style]')?.onload?.(new Event('load'));
    await first;

    await ensureStylesheetLoaded();
    expect(document.head.querySelectorAll('[data-ngx-pdf-viewer-style]')).toHaveLength(1);
  });

  it('resolves with a warning instead of hanging when the stylesheet is unreachable', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const loaded = ensureStylesheetLoaded({ cdnBaseUrl: 'https://blocked.example' });

    document.head.querySelector<HTMLLinkElement>('[data-ngx-pdf-viewer-style]')?.onerror?.(new Event('error'));
    await expect(loaded).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('https://blocked.example/web/pdf_viewer.css'));
  });
});
