import { describe, expect, it, vi } from 'vitest';
import { PdfViewerSyncService } from './viewer-sync.service';
import type { SyncStateTracker, ViewerSyncState } from '../../core/models/viewer.model';

type SyncContext = Parameters<PdfViewerSyncService['sync']>[2];

function makeState(doc: unknown, overrides: Partial<ViewerSyncState> = {}): ViewerSyncState {
  return {
    doc: doc as never,
    scale: {
      zoom: 1,
      zoomScale: 'page-width',
      rotation: 0,
      originalSize: false,
      fitToPage: true,
      showBorders: false,
    },
    reconfigure: { renderText: true, renderTextMode: 1, annotationMode: 1 },
    page: 1,
    stickToPage: false,
    enableHandTool: false,
    ...overrides,
  };
}

function makeTracker(lastKey = '', lastScaleKey = ''): SyncStateTracker {
  return {
    lastReconfigureKey: lastKey,
    lastScaleKey,
    lastEmittedDoc: null,
    getLatestScrolledPage: () => 1,
    setLatestScrolledPage: () => {},
  };
}

interface CtxOverrides {
  updateScaleAndRender?: (...args: unknown[]) => void;
  scrollToPage?: (...args: unknown[]) => void;
  getPdfViewer?: () => unknown;
  onReconfigure?: (config: unknown) => Promise<void>;
  onHandTool?: (enabled: boolean) => void;
  onLoadComplete?: (doc: unknown) => void;
}

function baseCtx(overrides: CtxOverrides = {}, container: HTMLDivElement | null = null): SyncContext {
  return {
    container,
    scaleService: {
      updateScaleAndRender: overrides['updateScaleAndRender'] ?? (() => {}),
    },
    facade: {
      scrollToPage: overrides['scrollToPage'] ?? (() => {}),
      getPdfViewer: overrides['getPdfViewer'] ?? (() => null),
    },
    onReconfigure: overrides['onReconfigure'] ?? (async () => {}),
    onHandTool: overrides['onHandTool'] ?? (() => {}),
    onLoadComplete: overrides['onLoadComplete'] ?? (() => {}),
    onError: () => {},
  } as never;
}

const MATCHING_KEY = 'true-1-1';

describe('PdfViewerSyncService.sync', () => {
  it('emits load-complete once per document', () => {
    const svc = new PdfViewerSyncService();
    const onLoadComplete = vi.fn();
    const doc = { numPages: 3 };
    const tracker = makeTracker(MATCHING_KEY);
    const ctx = baseCtx({ onLoadComplete });
    svc.sync(makeState(doc), tracker, ctx);
    svc.sync(makeState(doc), tracker, ctx);
    expect(onLoadComplete).toHaveBeenCalledTimes(1);
    expect(onLoadComplete).toHaveBeenCalledWith(doc);
  });

  it('emits load-complete again for a new document reference', () => {
    const svc = new PdfViewerSyncService();
    const onLoadComplete = vi.fn();
    const tracker = makeTracker(MATCHING_KEY);
    const ctx = baseCtx({ onLoadComplete });
    svc.sync(makeState({ numPages: 1 }), tracker, ctx);
    svc.sync(makeState({ numPages: 2 }), tracker, ctx);
    expect(onLoadComplete).toHaveBeenCalledTimes(2);
  });

  it('scrolls when target page differs from latest scrolled page', () => {
    const svc = new PdfViewerSyncService();
    const scrollToPage = vi.fn();
    const tracker = makeTracker(MATCHING_KEY);
    tracker.getLatestScrolledPage = () => 0;
    svc.sync(makeState({ numPages: 3 }, { page: 2 }), tracker, baseCtx({ scrollToPage }));
    expect(scrollToPage).toHaveBeenCalledWith(2, true);
    expect(tracker.lastEmittedDoc).not.toBeNull();
  });

  it('does not scroll when already on the target page', () => {
    const svc = new PdfViewerSyncService();
    const scrollToPage = vi.fn();
    svc.sync(makeState({ numPages: 3 }, { page: 1 }), makeTracker(MATCHING_KEY), baseCtx({ scrollToPage }));
    expect(scrollToPage).not.toHaveBeenCalled();
  });

  it('triggers reconfigure exactly once per unique key and applies hand tool first', () => {
    const svc = new PdfViewerSyncService();
    const onReconfigure = vi.fn(async () => {});
    const onHandTool = vi.fn();
    const ctx = baseCtx({ onReconfigure, onHandTool });
    svc.sync(makeState({ numPages: 1 }), makeTracker(''), ctx);
    svc.sync(makeState({ numPages: 1 }), makeTracker(MATCHING_KEY), ctx);
    expect(onReconfigure).toHaveBeenCalledTimes(1);
    expect(onHandTool).toHaveBeenCalledTimes(2);
    const handOrder = onHandTool.mock.invocationCallOrder[0];
    const reconfigureOrder = onReconfigure.mock.invocationCallOrder[0];
    expect(handOrder).toBeLessThan(reconfigureOrder);
  });

  it('applies scale when container present', () => {
    const svc = new PdfViewerSyncService();
    const updateScaleAndRender = vi.fn();
    const container = document.createElement('div');
    svc.sync(makeState({ numPages: 1 }), makeTracker(MATCHING_KEY), baseCtx({ updateScaleAndRender }, container));
    expect(updateScaleAndRender).toHaveBeenCalledOnce();
    // (facade, scaleContext, scaleConfig) — no page argument: the scale pass
    // must not reposition the viewer.
    expect(updateScaleAndRender.mock.calls[0]).toHaveLength(3);
    expect(updateScaleAndRender.mock.calls[0][2]).toMatchObject({ zoom: 1, rotation: 0 });
  });

  it('skips scale when container is absent', () => {
    const svc = new PdfViewerSyncService();
    const updateScaleAndRender = vi.fn();
    svc.sync(makeState({ numPages: 1 }), makeTracker(MATCHING_KEY), baseCtx({ updateScaleAndRender }));
    expect(updateScaleAndRender).not.toHaveBeenCalled();
  });

  // Regression: scrolling makes pdf.js emit `pagechanging`, which consumers
  // echo back into `[page]`, re-running sync many times a second. Each of those
  // used to re-run the scale pass, which re-scrolled the viewer to the top of
  // the current page — the scroll jank.
  it('does not re-run the scale pass when only the echoed page changes', () => {
    const svc = new PdfViewerSyncService();
    const updateScaleAndRender = vi.fn();
    const container = document.createElement('div');
    const doc = { numPages: 10 };
    const tracker = makeTracker(MATCHING_KEY);
    let scrolled = 1;
    tracker.getLatestScrolledPage = () => scrolled;
    tracker.setLatestScrolledPage = (p) => (scrolled = p);
    const ctx = baseCtx({ updateScaleAndRender }, container);

    svc.sync(makeState(doc, { page: 1 }), tracker, ctx);
    expect(updateScaleAndRender).toHaveBeenCalledOnce();

    // pdf.js reports pages 2..5 as the user scrolls; the component records each
    // one as the latest scrolled page before the echo arrives.
    for (const page of [2, 3, 4, 5]) {
      scrolled = page;
      svc.sync(makeState(doc, { page }), tracker, ctx);
    }
    expect(updateScaleAndRender).toHaveBeenCalledOnce();
  });

  it('re-runs the scale pass when a scale input actually changes', () => {
    const svc = new PdfViewerSyncService();
    const updateScaleAndRender = vi.fn();
    const container = document.createElement('div');
    const doc = { numPages: 3 };
    const tracker = makeTracker(MATCHING_KEY);
    const ctx = baseCtx({ updateScaleAndRender }, container);

    svc.sync(makeState(doc), tracker, ctx);
    svc.sync(makeState(doc, { scale: { ...makeState(doc).scale, zoom: 1.5 } }), tracker, ctx);
    svc.sync(makeState(doc, { scale: { ...makeState(doc).scale, rotation: 90 } }), tracker, ctx);
    expect(updateScaleAndRender).toHaveBeenCalledTimes(3);
  });

  it('recomputes scale for a new document even when scale inputs are unchanged', () => {
    const svc = new PdfViewerSyncService();
    const updateScaleAndRender = vi.fn();
    const container = document.createElement('div');
    const tracker = makeTracker(MATCHING_KEY);
    const ctx = baseCtx({ updateScaleAndRender }, container);

    svc.sync(makeState({ numPages: 1 }), tracker, ctx);
    svc.sync(makeState({ numPages: 2 }), tracker, ctx);
    expect(updateScaleAndRender).toHaveBeenCalledTimes(2);
  });

  it('does not re-assert stickToPage on an echoed page', async () => {
    const svc = new PdfViewerSyncService();
    const viewer = { currentPageNumber: 4 };
    const doc = { numPages: 10 };
    const tracker = makeTracker(MATCHING_KEY);
    tracker.getLatestScrolledPage = () => 4;
    svc.sync(makeState(doc, { page: 4, stickToPage: true }), tracker, baseCtx({ getPdfViewer: () => viewer }));
    viewer.currentPageNumber = 7; // user keeps scrolling
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(viewer.currentPageNumber).toBe(7);
  });

  it('applies stickToPage by setting viewer current page asynchronously', async () => {
    const svc = new PdfViewerSyncService();
    const viewer = { currentPageNumber: 0 };
    const tracker = makeTracker(MATCHING_KEY);
    tracker.getLatestScrolledPage = () => 0;
    svc.sync(
      makeState({ numPages: 3 }, { page: 2, stickToPage: true }),
      tracker,
      baseCtx({ getPdfViewer: () => viewer }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(viewer.currentPageNumber).toBe(2);
  });
});
