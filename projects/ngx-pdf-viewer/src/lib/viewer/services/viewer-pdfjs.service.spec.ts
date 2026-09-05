import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PDFJsBundle } from '../../core/models/pdfjs-api.model';
import { PdfjsService } from './viewer-pdfjs.service';

type LoadBundle = () => Promise<PDFJsBundle>;

function createService(): PdfjsService {
  TestBed.configureTestingModule({});
  return TestBed.inject(PdfjsService);
}

/** Replaces the CDN import with a stub, so these tests never touch the network. */
function stubLoadBundle(service: PdfjsService, impl: LoadBundle): ReturnType<typeof vi.fn> {
  const stub = vi.fn(impl);
  (service as unknown as { loadBundle: LoadBundle }).loadBundle = stub;
  return stub;
}

const fakeBundle = { lib: {}, viewer: {} } as PDFJsBundle;

describe('PdfjsService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('refuses to initialize during SSR with an actionable message', async () => {
    const service = createService();

    // `load()` checks isSSR() synchronously, before its first await, so the
    // globals only need to look server-side for the duration of the call.
    vi.stubGlobal('document', undefined);
    const rejected = service.load();
    vi.unstubAllGlobals();

    await expect(rejected).rejects.toThrow(/cannot be initialized during SSR/);
  });

  it('loads the bundle once and shares it across concurrent callers', async () => {
    const service = createService();
    const stub = stubLoadBundle(service, () => Promise.resolve(fakeBundle));

    const [first, second] = await Promise.all([service.load(), service.load()]);
    const third = await service.load();

    expect(stub).toHaveBeenCalledTimes(1);
    expect(first).toBe(fakeBundle);
    expect(second).toBe(fakeBundle);
    expect(third).toBe(fakeBundle);
  });

  it('retries after a failed load instead of caching the rejection forever', async () => {
    const service = createService();
    const stub = stubLoadBundle(service, () => Promise.reject(new Error('offline')));

    await expect(service.load()).rejects.toThrow('offline');

    stub.mockImplementation(() => Promise.resolve(fakeBundle));
    await expect(service.load()).resolves.toBe(fakeBundle);
    expect(stub).toHaveBeenCalledTimes(2);
  });
});
