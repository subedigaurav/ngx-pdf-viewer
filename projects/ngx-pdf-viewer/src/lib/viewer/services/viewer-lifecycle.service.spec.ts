import { describe, expect, it, vi } from 'vitest';
import type { PdfViewerFacadeService } from './viewer-facade.service';
import { PdfViewerLifecycleService } from './viewer-lifecycle.service';

function makeFacade(overrides: Record<string, unknown> = {}) {
  return {
    reconfigure: vi.fn(async () => {}),
    currentDocument: () => ({ numPages: 1 }),
    setDocument: vi.fn(),
    getPdfViewer: () => ({ firstPagePromise: Promise.resolve() }),
    ...overrides,
  } as unknown as PdfViewerFacadeService;
}

describe('PdfViewerLifecycleService reconfigure', () => {
  const config = { renderText: true, renderTextMode: 1, annotationMode: 1 };

  it('wires the current document through the full facade setDocument path', async () => {
    const lifecycle = new PdfViewerLifecycleService();
    const facade = makeFacade();
    const onComplete = vi.fn();
    const onError = vi.fn();

    await lifecycle.reconfigure(facade, {} as never, {} as never, config, {} as never, onComplete, onError);

    expect(facade.reconfigure).toHaveBeenCalledTimes(1);
    // The new find controller must receive the document too, otherwise the pages
    // keep highlighting state from an idle controller while the search runs elsewhere.
    expect(facade.setDocument).toHaveBeenCalledWith({ numPages: 1 });
    expect(facade.setDocument).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('skips setDocument when no document is loaded', async () => {
    const lifecycle = new PdfViewerLifecycleService();
    const facade = makeFacade({ currentDocument: () => null });
    const onComplete = vi.fn();
    const onError = vi.fn();

    await lifecycle.reconfigure(facade, {} as never, {} as never, config, {} as never, onComplete, onError);

    expect(facade.setDocument).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('reports errors from setDocument without skipping completion', async () => {
    const lifecycle = new PdfViewerLifecycleService();
    const facade = makeFacade({
      setDocument: vi.fn(() => {
        throw new Error('boom');
      }),
    });
    const onComplete = vi.fn();
    const onError = vi.fn();

    await lifecycle.reconfigure(facade, {} as never, {} as never, config, {} as never, onComplete, onError);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
