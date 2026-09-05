import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PdfjsService } from './services/viewer-pdfjs.service';
import type { EventBus, PDFJsBundle } from '../core/models/pdfjs-api.model';
import { PdfViewerError } from '../core/models/viewer-error.model';
import { PdfViewerComponent } from './viewer-component';

const PAGE_CHANGE_DEBOUNCE_MS = 100;

let viewerInstances: FakePdfViewer[] = [];
let createdBuses: FakeEventBus[] = [];
let pdfjsLoadCalls = 0;

/**
 * Mirrors pdf.js's EventBus: a plain listener map that hands the payload object
 * straight to each listener. It must NOT be a DOM EventTarget — pdf.js payloads
 * carry a `type` key (the find command's '' / 'again'), and copying that onto a
 * CustomEvent rewrites the event's own name so no listener ever matches.
 */
class FakeEventBus implements EventBus {
  private readonly listeners = new Map<string, Set<(event: unknown) => void>>();

  constructor() {
    createdBuses.push(this);
  }
  on(eventName: string, listener: (event: unknown) => void): void {
    const set = this.listeners.get(eventName) ?? new Set();
    set.add(listener);
    this.listeners.set(eventName, set);
  }
  off(eventName: string, listener: (event: unknown) => void): void {
    this.listeners.get(eventName)?.delete(listener);
  }
  dispatch(eventName: string, data?: Record<string, unknown>): void {
    for (const listener of [...(this.listeners.get(eventName) ?? [])]) {
      listener({ ...data });
    }
  }
}

class FakePdfViewer {
  firstPagePromise = Promise.resolve();
  currentPageNumber = 1;
  currentScale: number | string = 1;
  pagesRotation = 0;
  _currentPageNumber = 0;
  _pages: unknown[] = [];
  setDocument = vi.fn();
  scrollPageIntoView = vi.fn();
  forceRendering = vi.fn();
  update = vi.fn();
  cleanup = vi.fn();

  constructor(_config?: unknown) {
    viewerInstances.push(this);
  }
}

function makeFakeBundle(options: { rejectWith?: Error } = {}): {
  bundle: PDFJsBundle;
  fakeDoc: Record<string, unknown>;
} {
  const fakeDoc = {
    numPages: 3,
    getPage: async (pageNumber: number) => ({
      pageNumber,
      rotate: 0,
      getViewport: ({ scale }: { scale: number }) => ({
        width: 612 * scale,
        height: 792 * scale,
      }),
    }),
    getOutline: async () => [],
    getData: async () => new Uint8Array([1]),
    destroy: async () => {},
  };

  const loadPromise = options.rejectWith ? Promise.reject(options.rejectWith) : Promise.resolve(fakeDoc);
  // Mark the rejection as handled up-front so vitest does not report a
  // spurious unhandled rejection before the facade attaches its handler.
  loadPromise.catch(() => {});

  const loadingTask = options.rejectWith
    ? {
        promise: loadPromise,
        destroyed: false,
        destroy: vi.fn(async () => {}),
      }
    : {
        promise: loadPromise,
        destroyed: false,
        destroy: vi.fn(async () => {}),
      };

  const bundle = {
    lib: {
      version: '5.4.0',
      build: 'fake',
      getDocument: vi.fn(() => loadingTask),
      GlobalWorkerOptions: { workerSrc: '' },
    },
    viewer: {
      EventBus: FakeEventBus,
      PDFLinkService: class {
        setDocument = vi.fn();
        setViewer = vi.fn();
      },
      PDFFindController: class {
        setDocument = vi.fn();
        executeCommand = vi.fn();
      },
      PDFViewer: FakePdfViewer,
      GenericL10n: class {
        constructor(_locale?: string) {}
      },
      LinkTarget: { NONE: 0, SELF: 1, BLANK: 2, PARENT: 3, TOP: 4 },
    },
    AnnotationMode: { DISABLE: 0, ENABLE: 1, ENABLE_FORMS: 2, ENABLE_STORAGE: 3 },
    AnnotationEditorType: { DISABLE: 0 },
  } as unknown as PDFJsBundle;

  return { bundle, fakeDoc };
}

async function setupComponent(
  inputs: Record<string, unknown> = {},
  bundleOptions: { rejectWith?: Error } = {},
): Promise<{
  fixture: ComponentFixture<PdfViewerComponent>;
  bundle: PDFJsBundle;
  fakeDoc: Record<string, unknown>;
}> {
  viewerInstances = [];
  createdBuses = [];
  pdfjsLoadCalls = 0;
  const { bundle, fakeDoc } = makeFakeBundle(bundleOptions);

  TestBed.configureTestingModule({
    imports: [PdfViewerComponent],
    providers: [
      {
        provide: PdfjsService,
        useValue: {
          load: async () => {
            pdfjsLoadCalls++;
            return bundle;
          },
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(PdfViewerComponent);
  for (const [key, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(key, value);
  }
  fixture.componentRef.setInput('src', inputs['src'] ?? 'test.pdf');
  fixture.detectChanges();
  await Promise.resolve();
  return { fixture, bundle, fakeDoc };
}

describe('PdfViewerComponent', () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  let originalIntersectionObserver: unknown;
  let originalResizeObserver: unknown;

  beforeEach(() => {
    originalIntersectionObserver = globals['IntersectionObserver'];
    originalResizeObserver = globals['ResizeObserver'];
    // jsdom lacks IntersectionObserver; stub it to report the host as visible.
    globals['IntersectionObserver'] = class {
      constructor(private readonly callback: (entries: { isIntersecting: boolean }[]) => void) {}
      observe(): void {
        this.callback([{ isIntersecting: true }]);
      }
      disconnect(): void {}
      unobserve(): void {}
    };
  });

  afterEach(() => {
    if (originalIntersectionObserver === undefined) delete globals['IntersectionObserver'];
    else globals['IntersectionObserver'] = originalIntersectionObserver;
    if (originalResizeObserver === undefined) delete globals['ResizeObserver'];
    else globals['ResizeObserver'] = originalResizeObserver;
    TestBed.resetTestingModule();
  });

  it('creates a viewer instance once visible (double init guarded)', async () => {
    const callbacks: ((entries: { isIntersecting: boolean }[]) => void)[] = [];
    globals['IntersectionObserver'] = class {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        callbacks.push(callback);
      }
      observe(): void {}
      disconnect(): void {}
      unobserve(): void {}
    };
    const { fixture } = await setupComponent();
    // Fire the visibility callback twice; initialization must run exactly once.
    for (const cb of callbacks) cb([{ isIntersecting: true }]);
    await vi.waitFor(() => {
      expect(pdfjsLoadCalls).toBe(1);
    });
    for (const cb of callbacks) cb([{ isIntersecting: true }]);
    // Let any follow-on effects settle, then confirm no second init happened.
    await new Promise((resolve) => setTimeout(resolve, PAGE_CHANGE_DEBOUNCE_MS));
    expect(pdfjsLoadCalls).toBe(1);
    fixture.destroy();
  });

  it('emits afterLoadComplete with the loaded document', async () => {
    const loaded: unknown[] = [];
    const { fixture, fakeDoc } = await setupComponent();
    fixture.componentInstance.afterLoadComplete.subscribe((doc) => loaded.push(doc));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(loaded.length).toBe(1);
    });
    expect(loaded[0]).toBe(fakeDoc);
    expect(fixture.componentInstance.getPageCount()).toBe(3);
    fixture.destroy();
  });

  it('emits renamed error output on load failure', async () => {
    const boom = new Error('bad pdf');
    const errors: unknown[] = [];
    const { fixture } = await setupComponent({}, { rejectWith: boom });
    fixture.componentInstance.error.subscribe((e) => errors.push(e));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(errors.length).toBeGreaterThan(0);
    });
    expect(errors[0]).toBeInstanceOf(PdfViewerError);
    expect((errors[0] as PdfViewerError).code).toBe('LOAD_FAILED');
    fixture.destroy();
  });

  it('fires pageChange when eventBus dispatches debounced pagechanging', async () => {
    const pages: number[] = [];
    const { fixture } = await setupComponent();
    fixture.componentInstance.pageChange.subscribe((page) => pages.push(page));
    await vi.waitFor(() => {
      expect(createdBuses.length).toBeGreaterThan(0);
    });
    const bus = createdBuses[0];
    bus.dispatch('pagechanging', { pageNumber: 2 });
    expect(pages).toEqual([]);
    await new Promise((resolve) => setTimeout(resolve, PAGE_CHANGE_DEBOUNCE_MS + 60));
    expect(pages).toEqual([2]);
    fixture.destroy();
  });

  it('coerces string page numbers emitted by pagechanging', async () => {
    const pages: number[] = [];
    const { fixture } = await setupComponent();
    fixture.componentInstance.pageChange.subscribe((page) => pages.push(page));
    await vi.waitFor(() => {
      expect(createdBuses.length).toBeGreaterThan(0);
    });
    createdBuses[0].dispatch('pagechanging', { pageNumber: '4' });
    await new Promise((resolve) => setTimeout(resolve, PAGE_CHANGE_DEBOUNCE_MS + 60));
    expect(pages).toEqual([4]);
    fixture.destroy();
  });

  it('delegates search to the find controller via the event bus', async () => {
    const { fixture } = await setupComponent();
    await vi.waitFor(() => {
      expect(createdBuses.length).toBeGreaterThan(0);
    });
    const queries: unknown[] = [];
    createdBuses[0].on('find', (event) => queries.push((event as { query?: unknown }).query));
    fixture.componentInstance.search('hello', { caseSensitive: true });
    expect(queries).toContain('hello');
    fixture.componentInstance.clearSearch();
    expect(queries.length).toBeGreaterThanOrEqual(2);
    fixture.destroy();
  });
});
