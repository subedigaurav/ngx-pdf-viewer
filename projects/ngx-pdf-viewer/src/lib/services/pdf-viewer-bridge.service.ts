import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent, Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { PAGE_CHANGE_DEBOUNCE_TIME } from '../constants/pdf-viewer.constants';
import type { PDFDocumentProxy } from '../models/pdf-document.model';
import type {
  ExternalLinkTarget,
  PdfViewerBridgeConfig,
  PdfViewerEvents,
} from '../models/pdf-viewer.model';
import type {
  EventBus,
  PDFFindController,
  PDFJsViewer,
  PDFLinkService,
  PDFViewer,
  PDFViewerConstructorOptions,
} from '../models/pdfjs-api.model';
import { createEventBus } from '../utils/event-bus.util';
import { toIntegerPageNumber } from '../utils/pdf-scale.util';

/**
 * Service that bridges Angular component with PDF.js viewer.
 * Manages EventBus, LinkService, FindController, and PDFViewer lifecycle.
 *
 * @Injectable()
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

  /**
   * Gets the current PDF viewer instance
   */
  get pdfViewer(): PDFViewer {
    return this.viewer;
  }

  /**
   * Gets the PDF.js event bus
   */
  get bus(): EventBus {
    return this.eventBus;
  }

  /**
   * Initializes the PDF viewer bridge with PDF.js components
   *
   * @param pdfjsViewer - PDF.js viewer module
   * @param config - Bridge configuration
   * @param events - Event callbacks
   * @param annotationEditorMode - Annotation editor mode (typically DISABLE)
   */
  initialize(
    pdfjsViewer: PDFJsViewer,
    config: PdfViewerBridgeConfig,
    events: PdfViewerEvents,
  ): void {
    this.pdfjsViewer = pdfjsViewer;

    // initialize event bus
    this.eventBus = createEventBus(pdfjsViewer.EventBus, config.container, this.destroyRef);

    // initialize event listeners
    this.setupEventListeners(events);

    // initialize pdf.js services
    this.initializeLinkService(config.externalLinkTarget);
    this.initializeFindController();

    // initialize the viewer
    this.initializeViewer(config);
  }

  /**
   * Reconfigures the viewer with new settings (e.g., when renderText changes)
   *
   * @param config - New bridge configuration
   */
  reconfigure(config: PdfViewerBridgeConfig): void {
    // Replace the inner viewer div with a fresh one to avoid stale DOM from the previous viewer.
    const viewerDiv = config.container?.firstElementChild as HTMLElement | null;
    if (viewerDiv?.parentNode) {
      const newViewerDiv = document.createElement('div');
      newViewerDiv.className = viewerDiv.className || 'pdfViewer';
      viewerDiv.parentNode.replaceChild(newViewerDiv, viewerDiv);
    }

    // Reinitialize services with new config
    this.initializeLinkService(config.externalLinkTarget);
    this.initializeFindController();
    this.initializeViewer(config);
  }

  /**
   * Sets the PDF document in the viewer
   *
   * @param document - PDF document proxy or null to clear
   */
  setDocument(document: PDFDocumentProxy | null): void {
    this.linkService.setDocument(document as unknown, null);
    this.findController.setDocument(document as unknown);
    this.viewer.setDocument(document as unknown);
  }

  /**
   * Sets the current page number
   *
   * @param pageNumber - Page number to display
   */
  setCurrentPage(pageNumber: number): void {
    if (this.viewer) {
      this.viewer._currentPageNumber = toIntegerPageNumber(pageNumber);
    }
  }

  /**
   * Scrolls the specified page into view
   *
   * @param pageNumber - Page number to scroll to
   * @param ignoreDestinationZoom - Whether to ignore destination zoom
   */
  scrollPageIntoView(pageNumber: number, ignoreDestinationZoom = false): void {
    if (this.viewer) {
      this.viewer.scrollPageIntoView({
        pageNumber: toIntegerPageNumber(pageNumber),
        ignoreDestinationZoom,
      });
    }
  }

  /**
   * Forces rendering of visible pages
   */
  forceRendering(): void {
    if (this.viewer) {
      this.viewer.forceRendering();
    }
  }

  /**
   * Sets up event listeners for PDF.js events
   */
  private setupEventListeners(events: PdfViewerEvents): void {
    // Page rendered event
    fromEvent(this.eventBus, 'pagerendered')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => events.pageRendered(event as CustomEvent));

    // Pages initialized event
    fromEvent(this.eventBus, 'pagesinit')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => events.pagesInitialized(event as CustomEvent));

    // Text layer rendered event
    fromEvent(this.eventBus, 'textlayerrendered')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => events.textLayerRendered(event as CustomEvent));

    // Page changing event (debounced) - coerce to integer (PDF.js may emit string from URL hash)
    fromEvent<CustomEvent>(this.eventBus, 'pagechanging')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        const raw =
          event.detail?.pageNumber ?? (event as unknown as { pageNumber: number }).pageNumber;
        this.pageChange$.next(toIntegerPageNumber(raw));
      });

    // Debounced page change
    this.pageChange$
      .pipe(debounceTime(PAGE_CHANGE_DEBOUNCE_TIME), takeUntilDestroyed(this.destroyRef))
      .subscribe((pageNumber) => events.pageChanging(pageNumber));
  }

  /**
   * Initializes the PDF link service
   */
  private initializeLinkService(externalLinkTarget: ExternalLinkTarget): void {
    const config: { eventBus: EventBus; externalLinkTarget?: number } = {
      eventBus: this.eventBus,
    };

    // Map external link target to PDF.js constant
    const linkTarget = this.getLinkTargetValue(externalLinkTarget);
    if (linkTarget !== null) {
      config.externalLinkTarget = linkTarget;
    }

    this.linkService = new this.pdfjsViewer.PDFLinkService(config);
  }

  /**
   * Initializes the PDF find controller
   */
  private initializeFindController(): void {
    this.findController = new this.pdfjsViewer.PDFFindController({
      eventBus: this.eventBus,
      linkService: this.linkService,
    });
  }

  /**
   * Initializes the PDF viewer
   */
  private initializeViewer(config: PdfViewerBridgeConfig): void {
    const viewerElement = config.container?.firstElementChild as HTMLDivElement | null;
    const viewerOptions: PDFViewerConstructorOptions = {
      container: config.container,
      viewer: viewerElement ?? undefined,
      eventBus: this.eventBus,
      linkService: this.linkService,
      findController: this.findController,
      textLayerMode: config.renderText ? config.renderTextMode : 0,
      annotationMode: 0,
      removePageBorders: !config.showBorders,
      imageResourcesPath: config.imageResourcesPath,
      l10n: new this.pdfjsViewer.GenericL10n('en'),
    };

    this.viewer = new this.pdfjsViewer.PDFViewer(viewerOptions);

    // Link viewer to link service
    this.linkService.setViewer(this.viewer as unknown);
  }

  /**
   * Maps external link target string to PDF.js LinkTarget constant
   */
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
