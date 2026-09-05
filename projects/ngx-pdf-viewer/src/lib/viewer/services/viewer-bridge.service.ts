import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent, Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { PAGE_CHANGE_DEBOUNCE_TIME } from '../../core/constants/viewer-constants';
import type { PDFDocumentProxy } from '../../core/models/pdf-document.model';
import type {
  ExternalLinkTarget,
  PdfSearchMatches,
  PdfViewerBridgeConfig,
  PdfViewerEvents,
  SearchOptions,
} from '../../core/models/viewer.model';
import type {
  EventBus,
  PDFFindController,
  PDFJsViewer,
  PDFLinkService,
  PDFViewer,
  PDFViewerConstructorOptions,
} from '../../core/models/pdfjs-api.model';
import { createEventBus } from '../../core/utils/pdf-event-bus';
import { toIntegerPageNumber } from '../../core/utils/pdf-scale';

/**
 * Service that bridges Angular component with PDF.js viewer.
 * Manages EventBus, LinkService, FindController, and PDFViewer lifecycle.
 */
@Injectable()
export class PdfViewerBridgeService {
  private readonly destroyRef = inject(DestroyRef);

  private eventBus!: EventBus;
  private linkService!: PDFLinkService;
  private findController!: PDFFindController;
  private viewer!: PDFViewer;
  private pdfjsViewer!: PDFJsViewer;

  private readonly pageChange$ = new Subject<number>();
  private lastQuery = '';
  private lastOptions: SearchOptions = {};

  get pdfViewer(): PDFViewer {
    return this.viewer;
  }

  get bus(): EventBus {
    return this.eventBus;
  }

  initialize(pdfjsViewer: PDFJsViewer, config: PdfViewerBridgeConfig, events: PdfViewerEvents): void {
    this.pdfjsViewer = pdfjsViewer;
    this.eventBus = createEventBus(pdfjsViewer.EventBus, config.container, this.destroyRef);
    this.setupEventListeners(events);
    this.initializeLinkService(config.externalLinkTarget);
    this.initializeFindController();
    this.initializeViewer(config);
  }

  /** Reconfigures the viewer with new settings (e.g., when renderText changes). */
  reconfigure(config: PdfViewerBridgeConfig): void {
    // Replace the inner viewer div with a fresh one to avoid stale DOM from the previous viewer.
    const viewerDiv = config.container?.firstElementChild as HTMLElement | null;
    if (viewerDiv?.parentNode) {
      const newViewerDiv = document.createElement('div');
      newViewerDiv.className = viewerDiv.className || 'pdfViewer';
      viewerDiv.parentNode.replaceChild(newViewerDiv, viewerDiv);
    }

    // Detach the outgoing find controller from the document. It keeps listening to
    // 'find' events on the shared event bus; resetting its document makes those
    // handlers no-ops so stale instances never drive a search after reconfigure.
    this.findController?.setDocument(null);

    this.initializeLinkService(config.externalLinkTarget);
    this.initializeFindController();
    this.initializeViewer(config);
  }

  setDocument(document: PDFDocumentProxy | null): void {
    if (!this.linkService || !this.viewer) return;
    this.linkService.setDocument(document as unknown, null);
    this.findController?.setDocument(document as unknown);
    this.viewer.setDocument(document as unknown);
  }

  setCurrentPage(pageNumber: number): void {
    if (this.viewer) {
      this.viewer._currentPageNumber = toIntegerPageNumber(pageNumber);
    }
  }

  scrollPageIntoView(pageNumber: number, ignoreDestinationZoom = false): void {
    // Page views are created asynchronously inside pdf.js after `setDocument`;
    // calling this before they exist is a harmless no-op there, but it logs a
    // console error on every load, so skip it until pages actually exist.
    if (this.viewer && this.viewer._pages.length > 0) {
      this.viewer.scrollPageIntoView({
        pageNumber: toIntegerPageNumber(pageNumber),
        ignoreDestinationZoom,
      });
    }
  }

  forceRendering(): void {
    if (this.viewer) {
      this.viewer.forceRendering();
    }
  }

  search(query: string, options: SearchOptions = {}): void {
    if (!this.eventBus || !query) return;
    this.lastQuery = query;
    this.lastOptions = options;
    this.eventBus.dispatch('find', {
      source: this,
      type: '',
      query,
      phraseSearch: true,
      caseSensitive: options.caseSensitive ?? false,
      entireWord: options.entireWord ?? false,
      highlightAll: options.highlightAll ?? true,
      findPrevious: false,
      matchDiacritics: true,
    });
  }

  /** Re-runs the last search to jump to the next or previous match. */
  findAgain(findPrevious: boolean): void {
    if (!this.eventBus || !this.lastQuery) return;
    this.eventBus.dispatch('find', {
      source: this,
      type: 'again',
      query: this.lastQuery,
      phraseSearch: true,
      caseSensitive: this.lastOptions.caseSensitive ?? false,
      entireWord: this.lastOptions.entireWord ?? false,
      highlightAll: this.lastOptions.highlightAll ?? true,
      findPrevious,
      matchDiacritics: true,
    });
  }

  clearSearch(): void {
    this.lastQuery = '';
    if (!this.eventBus) return;
    this.eventBus.dispatch('find', {
      source: this,
      type: '',
      query: '',
      phraseSearch: true,
      caseSensitive: false,
      entireWord: false,
      highlightAll: false,
      findPrevious: false,
      matchDiacritics: true,
    });
  }

  navigateToDestination(destination: unknown): void {
    if (!this.linkService || destination == null) return;
    this.linkService.navigateTo(destination);
  }

  private setupEventListeners(events: PdfViewerEvents): void {
    fromEvent(this.eventBus, 'pagerendered')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => events.pageRendered(event as CustomEvent));

    fromEvent(this.eventBus, 'pagesinit')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => events.pagesInitialized(event as CustomEvent));

    fromEvent(this.eventBus, 'textlayerrendered')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => events.textLayerRendered(event as CustomEvent));

    // Page changing event (debounced) - coerce to integer (PDF.js may emit string from URL hash)
    fromEvent<CustomEvent>(this.eventBus, 'pagechanging')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        const raw = event.detail?.pageNumber ?? (event as unknown as { pageNumber: number }).pageNumber;
        this.pageChange$.next(toIntegerPageNumber(raw));
      });

    this.pageChange$
      .pipe(debounceTime(PAGE_CHANGE_DEBOUNCE_TIME), takeUntilDestroyed(this.destroyRef))
      .subscribe((pageNumber) => events.pageChanging(pageNumber));

    // Search match count/state updates from the find controller
    const emitSearchMatches = (event: CustomEvent): void => {
      const matches = (event as unknown as { matchesCount?: PdfSearchMatches }).matchesCount;
      events.searchMatchesChange(matches && matches.total > 0 ? matches : null);
    };
    fromEvent<CustomEvent>(this.eventBus, 'updatefindmatchescount')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(emitSearchMatches);
    fromEvent<CustomEvent>(this.eventBus, 'updatefindcontrolstate')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(emitSearchMatches);
  }

  private initializeLinkService(externalLinkTarget: ExternalLinkTarget): void {
    const config: { eventBus: EventBus; externalLinkTarget?: number } = {
      eventBus: this.eventBus,
    };

    const linkTarget = this.getLinkTargetValue(externalLinkTarget);
    if (linkTarget !== null) {
      config.externalLinkTarget = linkTarget;
    }

    this.linkService = new this.pdfjsViewer.PDFLinkService(config);
  }

  private initializeFindController(): void {
    this.findController = new this.pdfjsViewer.PDFFindController({
      eventBus: this.eventBus,
      linkService: this.linkService,
    });
  }

  private initializeViewer(config: PdfViewerBridgeConfig): void {
    const viewerElement = config.container?.firstElementChild as HTMLDivElement | null;
    const viewerOptions: PDFViewerConstructorOptions = {
      container: config.container,
      viewer: viewerElement ?? undefined,
      eventBus: this.eventBus,
      linkService: this.linkService,
      findController: this.findController,
      textLayerMode: config.renderText ? config.renderTextMode : 0,
      annotationMode: config.annotationMode,
      enableAutoLinking: false,
      removePageBorders: !config.showBorders,
      imageResourcesPath: config.imageResourcesPath,
      maxCanvasPixels: config.maxCanvasPixels,
      l10n: new this.pdfjsViewer.GenericL10n(config.locale ?? 'en'),
    };

    this.viewer = new this.pdfjsViewer.PDFViewer(viewerOptions);
    this.linkService.setViewer(this.viewer as unknown);
  }

  private getLinkTargetValue(target: ExternalLinkTarget): number | null {
    const LinkTarget = this.pdfjsViewer.LinkTarget;
    if (!LinkTarget) return null;

    switch (target) {
      case 'blank':
        return LinkTarget.BLANK;
      case 'none':
        return LinkTarget.NONE;
      case 'self':
        return LinkTarget.SELF;
      case 'parent':
        return LinkTarget.PARENT;
      case 'top':
        return LinkTarget.TOP;
      default:
        return null;
    }
  }
}
