import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { isSSR } from '../core/config/viewer-config';
import type {
  PDFDocumentProxy,
  PDFDocumentMetadata,
  PDFOutlineItem,
  PDFProgressData,
  PDFSource,
} from '../core/models/pdf-document.model';
import type { PDFJsBundle } from '../core/models/pdfjs-api.model';
import { PdfViewerError, toPdfViewerError } from '../core/models/viewer-error.model';
import {
  RenderTextMode,
  type AnnotationDisplayMode,
  type ExternalLinkTarget,
  type PdfSearchMatches,
  type PdfViewerOptions,
  type ScaleContext,
  type SearchOptions,
  type SyncStateTracker,
  type ThumbnailData,
  type ViewerSyncState,
  type ZoomScale,
} from '../core/models/viewer.model';
import { PdfViewerDocumentActionsService } from './services/viewer-actions.service';
import { PdfViewerFacadeService } from './services/viewer-facade.service';
import { PdfViewerLifecycleService } from './services/viewer-lifecycle.service';
import { PdfViewerScaleService } from './services/viewer-scale.service';
import { PdfViewerSyncService } from './services/viewer-sync.service';
import { PdfViewerBridgeService } from './services/viewer-bridge.service';
import { PdfjsService } from './services/viewer-pdfjs.service';
import { toIntegerPageNumber } from '../core/utils/pdf-scale';
import { PdfViewerHostService } from './services/viewer-host.service';

@Component({
  selector: 'ngx-pdf-viewer',
  standalone: true,
  templateUrl: './viewer-component.html',
  styleUrls: ['./viewer-component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    PdfViewerBridgeService,
    PdfViewerDocumentActionsService,
    PdfViewerFacadeService,
    PdfViewerScaleService,
    PdfViewerSyncService,
    PdfViewerLifecycleService,
    PdfViewerHostService,
  ],
  imports: [NgTemplateOutlet],
})
export class PdfViewerComponent implements AfterViewInit {
  private readonly facade = inject(PdfViewerFacadeService);
  private readonly documentActions = inject(PdfViewerDocumentActionsService);
  private readonly bridge = inject(PdfViewerBridgeService);
  private readonly pdfjs = inject(PdfjsService);
  private readonly scaleService = inject(PdfViewerScaleService);
  private readonly syncService = inject(PdfViewerSyncService);
  private readonly lifecycleService = inject(PdfViewerLifecycleService);
  private readonly hostService = inject(PdfViewerHostService);
  private readonly destroyRef = inject(DestroyRef);

  readonly containerRef = viewChild<ElementRef<HTMLDivElement>>('pdfViewerContainer');

  readonly src = input<string | Uint8Array | PDFSource | undefined>();
  readonly page = input<number>(1);
  readonly renderText = input<boolean>(true);
  readonly renderTextMode = input<RenderTextMode>(RenderTextMode.ENABLED);
  readonly originalSize = input<boolean>(false);
  readonly stickToPage = input<boolean>(false);
  readonly zoom = input<number>(1);
  readonly zoomScale = input<ZoomScale>('page-width');
  readonly rotation = input<number>(0);
  readonly autoresize = input<boolean>(true);
  readonly fitToPage = input<boolean>(true);
  readonly showBorders = input<boolean>(false);
  readonly cMapsUrl = input<string | null>(null);
  readonly externalLinkTarget = input<ExternalLinkTarget>('blank');
  readonly enableHandTool = input<boolean | undefined>(undefined);
  readonly annotationMode = input<AnnotationDisplayMode>('enabled');
  readonly locale = input<string>('en');
  readonly passwordProvider = input<((reason: number) => Promise<string | null>) | undefined>();
  readonly loadingTemplate = input<TemplateRef<unknown> | null>(null);
  readonly isLoading = signal(false);

  readonly afterLoadComplete = output<PDFDocumentProxy>();
  readonly pageRendered = output<CustomEvent>();
  readonly pagesInitialized = output<CustomEvent>();
  readonly textLayerRendered = output<CustomEvent>();
  // eslint-disable-next-line @angular-eslint/no-output-native -- intentional breaking rename per v1 API
  readonly error = output<PdfViewerError>();
  // eslint-disable-next-line @angular-eslint/no-output-native -- intentional breaking rename per v1 API
  readonly progress = output<PDFProgressData>();
  readonly pageChange = output<number>();
  readonly outlineLoaded = output<PDFOutlineItem[]>();
  readonly searchResults = output<PdfSearchMatches | null>();

  private readonly isVisible = signal(false);
  private readonly isInitialized = signal(false);
  private readonly latestScrolledPage = signal(0);
  private pdfjsBundle: PDFJsBundle | null = null;
  private destroyed = false;
  private initializePromise: Promise<void> | null = null;
  private loadRequestId = 0;

  private readonly viewerReady = computed(() => this.isVisible() && this.isInitialized() && !!this.pdfjsBundle);
  private readonly currentDocument = this.facade.currentDocument;

  private readonly viewerState = computed((): ViewerSyncState | null => {
    const doc = this.currentDocument();
    if (!this.viewerReady() || !doc) return null;

    return {
      doc,
      scale: this.getScaleConfig(),
      reconfigure: {
        renderText: this.renderText(),
        renderTextMode: this.renderTextMode(),
        annotationMode: this.resolveAnnotationMode(this.pdfjsBundle),
      },
      page: this.page(),
      stickToPage: this.stickToPage(),
      enableHandTool: this.facade.getEnableHandTool(this.enableHandTool()),
    };
  });

  private readonly syncTracker: SyncStateTracker = {
    lastReconfigureKey: '',
    lastScaleKey: '',
    lastEmittedDoc: null,
    getLatestScrolledPage: () => this.latestScrolledPage(),
    setLatestScrolledPage: (page) => this.latestScrolledPage.set(page),
  };

  constructor() {
    if (isSSR()) return;

    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      void this.cleanup();
    });

    effect(() => {
      const src = this.src();
      if (this.viewerReady() && src) this.loadPdf();
    });

    effect(() => {
      const state = this.viewerState();
      if (!state) return;
      this.syncService.sync(state, this.syncTracker, {
        container: this.containerRef()?.nativeElement ?? null,
        scaleService: this.scaleService,
        facade: this.facade,
        onReconfigure: (config) => this.reconfigureViewer(config),
        onHandTool: (enabled) => this.updateHandTool(enabled),
        onLoadComplete: (doc) => {
          this.afterLoadComplete.emit(doc);
          void this.documentActions
            .getOutline()
            .then((outline) => this.outlineLoaded.emit(outline))
            .catch(() => {});
        },
        onError: (err) => this.error.emit(toPdfViewerError(err)),
      });
    });

    this.hostService.observeResize(
      () => this.autoresize() && !!this.currentDocument(),
      () => this.applyScaleUpdate(),
    );
    this.setupFacadeEventHandlers();
  }

  ngAfterViewInit(): void {
    this.setupVisibilityObserver();
  }

  private setupVisibilityObserver(): void {
    this.hostService.observeVisibility((visible) => {
      if (visible && !this.isInitialized()) void this.initializeOnce();
      this.isVisible.set(visible);
    });
  }

  private initializeOnce(): Promise<void> {
    this.initializePromise ??= this.doInitialize();
    return this.initializePromise;
  }

  private async doInitialize(): Promise<void> {
    if (this.isInitialized() || this.destroyed) return;
    try {
      const bundle = await this.pdfjs.load();
      if (this.destroyed) return;
      this.pdfjsBundle = bundle;
      const container = this.containerRef()?.nativeElement;
      if (!container) {
        if (!this.destroyed) this.initializePromise = null;
        return;
      }
      if (this.destroyed) return;
      await this.initializeViewer(container);
      if (!this.destroyed) this.isInitialized.set(true);
    } catch (error) {
      this.initializePromise = null;
      if (!this.destroyed) this.error.emit(toPdfViewerError(error));
    }
  }

  private async initializeViewer(container: HTMLDivElement): Promise<void> {
    if (!this.pdfjsBundle) return;

    const options: PdfViewerOptions = {
      renderText: this.renderText(),
      renderTextMode: this.renderTextMode(),
      showBorders: this.showBorders(),
      externalLinkTarget: this.externalLinkTarget(),
      annotationMode: this.resolveAnnotationMode(this.pdfjsBundle),
      locale: this.locale(),
    };

    await this.lifecycleService.initialize(this.facade, {
      container,
      pdfjsBundle: this.pdfjsBundle,
      options,
      events: {
        pageRendered: (e) => this.pageRendered.emit(e),
        pagesInitialized: (e) => this.pagesInitialized.emit(e),
        textLayerRendered: (e) => this.textLayerRendered.emit(e),
        pageChanging: (page) => {
          const num = toIntegerPageNumber(page);
          this.latestScrolledPage.set(num);
          this.pageChange.emit(num);
        },
        searchMatchesChange: (matches) => this.searchResults.emit(matches),
      },
    });

    // The initial configuration is applied above; record it so the first sync()
    // does not trigger a redundant reconfigure. Reconstituting the viewer would
    // create a second PDFFindController: the pages would keep highlighting from
    // the new idle controller while search dispatches run through the old one.
    this.syncTracker.lastReconfigureKey = this.getReconfigureKey(options);
  }

  private getReconfigureKey(
    options: Pick<PdfViewerOptions, 'renderText' | 'renderTextMode' | 'annotationMode'>,
  ): string {
    return `${options.renderText}-${options.renderTextMode}-${options.annotationMode}`;
  }

  private async reconfigureViewer(config: ViewerSyncState['reconfigure']): Promise<void> {
    if (this.destroyed) return;
    if (!this.pdfjsBundle) return;

    const container = this.containerRef()?.nativeElement;
    if (!container) return;

    await this.lifecycleService.reconfigure(
      this.facade,
      this.pdfjsBundle,
      container,
      config,
      {
        showBorders: this.showBorders(),
        externalLinkTarget: this.externalLinkTarget(),
        locale: this.locale(),
      },
      () => this.applyScaleUpdate(),
      (err) => this.error.emit(toPdfViewerError(err)),
    );
  }

  private applyScaleUpdate(): void {
    const doc = this.currentDocument();
    const container = this.containerRef()?.nativeElement;
    const viewer = this.facade.getPdfViewer();
    if (!doc || !container || !viewer) return;

    const context: ScaleContext = {
      container,
      doc,
      viewer,
      onError: (err) => this.error.emit(toPdfViewerError(err)),
    };
    this.scaleService.updateScaleAndRender(this.facade, context, this.getScaleConfig());
  }

  private async loadPdf(): Promise<void> {
    const src = this.src();
    if (!src || !this.pdfjsBundle) return;

    const requestId = ++this.loadRequestId;
    this.isLoading.set(true);
    const cMapsUrl = this.facade.getCMapsUrl(this.cMapsUrl());
    try {
      await this.facade.loadDocument(src, cMapsUrl, this.pdfjsBundle, this.passwordProvider());
    } finally {
      if (requestId === this.loadRequestId) this.isLoading.set(false);
    }
  }

  /**
   * Searches the loaded document for the given query via the PDF.js find controller.
   */
  search(query: string, options?: SearchOptions): void {
    this.bridge.search(query, options);
  }

  /**
   * Jumps to the next match for the most recent search.
   */
  findNext(): void {
    this.bridge.findAgain(false);
  }

  /**
   * Jumps to the previous match for the most recent search.
   */
  findPrevious(): void {
    this.bridge.findAgain(true);
  }

  /**
   * Clears the active search and its highlights.
   */
  clearSearch(): void {
    this.bridge.clearSearch();
    this.searchResults.emit(null);
  }

  /**
   * Gets the document outline, or an empty array when none exists.
   */
  async getOutline(): Promise<PDFOutlineItem[]> {
    return this.documentActions.getOutline();
  }

  /**
   * Gets the metadata embedded in the current document.
   */
  async getMetadata(): Promise<PDFDocumentMetadata> {
    return this.documentActions.getMetadata();
  }

  /**
   * Navigates to an internal table-of-contents entry.
   */
  navigateToOutline(item: PDFOutlineItem): void {
    this.documentActions.navigateToOutline(item);
  }

  /**
   * Renders a thumbnail for the given page at a max width of 150px.
   */
  async getThumbnail(page: number): Promise<ThumbnailData> {
    return this.documentActions.getThumbnail(page);
  }

  /**
   * Downloads the current document's raw bytes as a PDF file.
   */
  async download(filename?: string): Promise<void> {
    await this.documentActions.download(filename);
  }

  /**
   * Prints the current document by loading it into a hidden iframe.
   */
  async print(): Promise<void> {
    await this.documentActions.print();
  }

  /**
   * Gets the number of pages in the current document (0 when none is loaded).
   */
  getPageCount(): number {
    return this.documentActions.getPageCount();
  }

  private setupFacadeEventHandlers(): void {
    effect(() => {
      const err = this.facade.loadError();
      if (err) this.error.emit(err);
    });

    effect(() => {
      const progress = this.facade.loadProgress();
      if (progress) this.progress.emit(progress);
    });
  }

  private resolveAnnotationMode(bundle: PDFJsBundle | null): number {
    const am = bundle?.AnnotationMode;
    switch (this.annotationMode()) {
      case 'none':
        return 0;
      case 'forms':
        return am?.ENABLE_FORMS ?? 2;
      case 'storage':
        return am?.ENABLE_STORAGE ?? 3;
      case 'enabled':
      default:
        return am?.ENABLE ?? 1;
    }
  }

  private getScaleConfig(): ViewerSyncState['scale'] {
    return {
      zoom: this.zoom(),
      zoomScale: this.zoomScale(),
      rotation: this.rotation(),
      originalSize: this.originalSize(),
      fitToPage: this.fitToPage(),
      showBorders: this.showBorders(),
    };
  }

  private updateHandTool(enabled: boolean): void {
    const container = this.containerRef()?.nativeElement;
    if (!container) return;

    this.hostService.setHandTool(container, enabled);
  }

  private async cleanup(): Promise<void> {
    this.hostService.clearHandTool();
    this.syncTracker.lastReconfigureKey = '';
    this.syncTracker.lastScaleKey = '';
    this.syncTracker.lastEmittedDoc = null;
    await this.facade.cleanup();
  }
}
