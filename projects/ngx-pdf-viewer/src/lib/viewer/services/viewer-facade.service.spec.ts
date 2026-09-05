import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { PdfViewerBridgeService } from './viewer-bridge.service';
import { PdfViewerFacadeService } from './viewer-facade.service';
import { PdfViewerError } from '../../core/models/viewer-error.model';

/** Already-resolved by getCMapsUrl() before loadDocument is ever called. */
const CMAPS_URL = 'https://cdn.example/cmaps/';

type OnPasswordFn = (callback: (password: string) => void, reason: number) => void;

function createFacade(): PdfViewerFacadeService {
  TestBed.configureTestingModule({ providers: [PdfViewerBridgeService] });
  return TestBed.runInInjectionContext(() => new PdfViewerFacadeService());
}

function createFakeBundle(fakeTask: {
  promise: Promise<unknown>;
  destroyed: boolean;
  destroy: () => Promise<void>;
}): never {
  return {
    lib: { getDocument: () => fakeTask, version: '5.4.0' },
    viewer: {},
    AnnotationMode: { DISABLE: 0, ENABLE: 1, ENABLE_FORMS: 2, ENABLE_STORAGE: 3 },
  } as never;
}

describe('PdfViewerFacadeService setDocument', () => {
  it('delegates to the bridge setDocument', () => {
    TestBed.configureTestingModule({ providers: [PdfViewerBridgeService] });
    const facade = TestBed.runInInjectionContext(() => new PdfViewerFacadeService());
    const bridge = TestBed.inject(PdfViewerBridgeService);
    const spy = vi.spyOn(bridge, 'setDocument');
    const doc = { numPages: 1 } as never;

    facade.setDocument(doc);
    expect(spy).toHaveBeenCalledWith(doc);

    facade.setDocument(null);
    expect(spy).toHaveBeenCalledWith(null);
  });
});

describe('PdfViewerFacadeService source dedup', () => {
  it('treats identical string sources as the same', () => {
    const facade = createFacade();
    facade['lastLoadedSrcRef'] = 'a.pdf';
    expect(facade['isSameSource']('a.pdf')).toBe(true);
    expect(facade['isSameSource']('b.pdf')).toBe(false);
  });

  it('compares Uint8Array sources by reference', () => {
    const facade = createFacade();
    const bytes = new Uint8Array([1, 2, 3]);
    facade['lastLoadedSrcRef'] = bytes;
    expect(facade['isSameSource'](bytes)).toBe(true);
    expect(facade['isSameSource'](new Uint8Array([1, 2, 3]))).toBe(false);
  });

  it('never dedups object parameter sources', () => {
    const facade = createFacade();
    const params = { url: 'a.pdf' };
    facade['lastLoadedSrcRef'] = params;
    expect(facade['isSameSource']({ url: 'a.pdf' })).toBe(false);
  });
});

describe('PdfViewerFacadeService source switching', () => {
  // pdf.js 6's PDFDocumentProxy exposes cleanup(), NOT destroy() — a document
  // is torn down by destroying its loading task. Mirror that here: a mock with
  // a destroy() would hide the regression this test exists for.
  function createDoc(numPages: number) {
    return { numPages, cleanup: vi.fn(async () => {}) };
  }

  function createResolvedTask(doc: unknown) {
    return {
      promise: Promise.resolve(doc),
      destroyed: false,
      destroy: vi.fn(async () => {}),
      onProgress: undefined,
      onPassword: undefined,
    };
  }

  it('loads a second source after the first and destroys the previous task', async () => {
    const facade = createFacade();
    const docA = createDoc(1);
    const docB = createDoc(2);
    const taskA = createResolvedTask(docA);
    const taskB = createResolvedTask(docB);
    let nextTask: unknown = taskA;
    const bundle = {
      lib: { getDocument: () => nextTask, version: '6.3.289' },
      viewer: {},
      AnnotationMode: { DISABLE: 0, ENABLE: 1, ENABLE_FORMS: 2, ENABLE_STORAGE: 3 },
    } as never;

    await facade.loadDocument('a.pdf', CMAPS_URL, bundle);
    expect(facade.currentDocument()).toBe(docA);

    nextTask = taskB;
    await facade.loadDocument('b.pdf', CMAPS_URL, bundle);

    expect(facade.loadError()).toBeNull();
    expect(facade.currentDocument()).toBe(docB);
    expect(taskA.destroy).toHaveBeenCalled();
  });
});

describe('PdfViewerFacadeService password handling', () => {
  function createFakeTask(promise: Promise<unknown>, onPasswordSetter: (fn: OnPasswordFn) => void) {
    return {
      promise,
      destroyed: false,
      destroy: vi.fn(async () => {}),
      onProgress: undefined,
      set onPassword(fn: OnPasswordFn) {
        onPasswordSetter(fn);
      },
    };
  }

  it('forwards provider-supplied password via pdf.js callback', async () => {
    const facade = createFacade();
    let onPasswordFn: OnPasswordFn | undefined;
    let receivedPassword: string | undefined;
    const fakeTask = createFakeTask(new Promise<never>(() => {}), (fn) => (onPasswordFn = fn));
    void facade.loadDocument('doc.pdf', CMAPS_URL, createFakeBundle(fakeTask), async () => 'secret');
    await new Promise((r) => setTimeout(r, 0));
    onPasswordFn?.((pw) => (receivedPassword = pw), 1);
    await vi.waitFor(() => {
      expect(receivedPassword).toBe('secret');
      expect(facade.loadError()).toBeNull();
    });
  });

  it('emits PASSWORD_CANCELLED when provider returns null', async () => {
    const facade = createFacade();
    let pdfReject: ((e: unknown) => void) | undefined;
    const promise = new Promise((_r, rej) => (pdfReject = rej));
    let onPasswordFn: OnPasswordFn | undefined;
    const fakeTask = createFakeTask(promise, (fn) => (onPasswordFn = fn));
    void facade.loadDocument('doc.pdf', CMAPS_URL, createFakeBundle(fakeTask), async () => null);
    await new Promise((r) => setTimeout(r, 0));
    onPasswordFn?.(() => {}, 1);
    await vi.waitFor(() => {
      const err = facade.loadError();
      expect(err).toBeInstanceOf(PdfViewerError);
      expect(err?.code).toBe('PASSWORD_CANCELLED');
    });
    expect(fakeTask.destroyed).toBe(false);
    expect(fakeTask.destroy).toHaveBeenCalled();
    void pdfReject;
  });

  it('emits PASSWORD_REQUIRED when no passwordProvider is given', async () => {
    const facade = createFacade();
    let onPasswordFn: OnPasswordFn | undefined;
    const fakeTask = createFakeTask(new Promise<never>(() => {}), (fn) => (onPasswordFn = fn));
    void facade.loadDocument('doc.pdf', CMAPS_URL, createFakeBundle(fakeTask));
    await new Promise((r) => setTimeout(r, 0));
    onPasswordFn?.(() => {}, 1);
    await vi.waitFor(() => {
      const err = facade.loadError();
      expect(err).toBeInstanceOf(PdfViewerError);
      expect(err?.code).toBe('PASSWORD_REQUIRED');
    });
    expect(fakeTask.destroy).toHaveBeenCalled();
  });

  it('keeps PASSWORD_CANCELLED when destroy rejects the pending load promise', async () => {
    const facade = createFacade();
    let rejectPromise: ((e: unknown) => void) | undefined;
    let onPasswordFn: OnPasswordFn | undefined;
    const promise = new Promise((_r, rej) => (rejectPromise = rej));
    const fakeTask = createFakeTask(promise, (fn) => (onPasswordFn = fn));
    fakeTask.destroy = vi.fn(async () => {
      rejectPromise?.(new Error('Worker was destroyed'));
    });
    void facade.loadDocument('doc.pdf', CMAPS_URL, createFakeBundle(fakeTask), async () => null);
    await new Promise((r) => setTimeout(r, 0));
    onPasswordFn?.(() => {}, 1);
    await vi.waitFor(() => {
      expect(fakeTask.destroy).toHaveBeenCalled();
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(facade.loadError()?.code).toBe('PASSWORD_CANCELLED');
  });

  it('maps a rejecting passwordProvider to PASSWORD_CANCELLED without unhandled rejection', async () => {
    const facade = createFacade();
    let onPasswordFn: OnPasswordFn | undefined;
    const fakeTask = createFakeTask(new Promise<never>(() => {}), (fn) => (onPasswordFn = fn));
    const provider = vi.fn(async () => {
      throw new Error('prompt blew up');
    });
    void facade.loadDocument('doc.pdf', CMAPS_URL, createFakeBundle(fakeTask), provider);
    await new Promise((r) => setTimeout(r, 0));
    onPasswordFn?.(() => {}, 1);
    await vi.waitFor(() => {
      const err = facade.loadError();
      expect(err).toBeInstanceOf(PdfViewerError);
      expect(err?.code).toBe('PASSWORD_CANCELLED');
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(fakeTask.destroy).toHaveBeenCalled();
  });

  it('passes the numeric password reason to the provider', async () => {
    const facade = createFacade();
    let onPasswordFn: OnPasswordFn | undefined;
    let receivedPassword: string | undefined;
    const fakeTask = createFakeTask(new Promise<never>(() => {}), (fn) => (onPasswordFn = fn));
    const provider = vi.fn(async () => 'pw');
    void facade.loadDocument('doc.pdf', CMAPS_URL, createFakeBundle(fakeTask), provider);
    await new Promise((r) => setTimeout(r, 0));
    onPasswordFn?.((pw) => (receivedPassword = pw), 2);
    await vi.waitFor(() => {
      expect(provider).toHaveBeenCalledWith(2);
      expect(receivedPassword).toBe('pw');
    });
  });
});
