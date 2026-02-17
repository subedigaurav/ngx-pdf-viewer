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
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import { debounceTime, filter } from 'rxjs/operators';
import { isSSR } from '../config/pdf-viewer.config';
import { RESIZE_DEBOUNCE_TIME } from '../constants/pdf-viewer.constants';
import type { PDFDocumentProxy, PDFProgressData, PDFSource } from '../models/pdf-document.model';
import {
  RenderTextMode,
  type ExternalLinkTarget,
  type HandToolCleanup,
  type PdfViewerOptions,
  type ScaleContext,
  type SyncStateTracker,
  type ViewerSyncState,
  type ZoomScale,
} from '../models/pdf-viewer.model';
import { PdfViewerBridgeService } from '../services/pdf-viewer-bridge.service';
import { PdfViewerFacadeService } from '../services/pdf-viewer-facade.service';
import { PdfViewerLifecycleService } from '../services/pdf-viewer-lifecycle.service';
import { PdfViewerScaleService } from '../services/pdf-viewer-scale.service';
import { PdfViewerSyncService } from '../services/pdf-viewer-sync.service';
import { PdfjsLoaderService } from '../services/pdfjs-loader.service';
import { setupHandTool } from '../utils/hand-tool.util';
import { normalizePageNumber, toIntegerPageNumber } from '../utils/pdf-scale.util';

@Component({
  selector: 'ngx-pdf-viewer',
  templateUrl: './pdf-viewer.component.html',
  styleUrls: ['./pdf-viewer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    PdfViewerBridgeService,
    PdfViewerFacadeService,
    PdfViewerScaleService,
    PdfViewerSyncService,
    PdfViewerLifecycleService,
  ],
  standalone: true,
})
export class PdfViewerComponent implements AfterViewInit {
  private readonly hostElement = inject(ElementRef<HTMLElement>);
  private readonly facade = inject(PdfViewerFacadeService);
  private readonly loader = inject(PdfjsLoaderService);
  private readonly scaleService = inject(PdfViewerScaleService);
  private readonly syncService = inject(PdfViewerSyncService);
  private readonly lifecycleService = inject(PdfViewerLifecycleService);
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
  readonly enableHandTool = input<boolean>(false);

  readonly afterLoadComplete = output<PDFDocumentProxy>();
  readonly pageRendered = output<CustomEvent>();
  readonly pagesInitialized = output<CustomEvent>();
  readonly textLayerRendered = output<CustomEvent>();
  readonly onError = output<Error>();
  readonly onProgress = output<PDFProgressData>();
  readonly pageChange = output<number>();

  private readonly isVisible = signal(false);
  private readonly isInitialized = signal(false);
  private readonly latestScrolledPage = signal(0);
  private pdfjsBundle: Awaited<ReturnType<PdfjsLoaderService['load']>> | null = null;
  private handToolCleanup: HandToolCleanup | null = null;

  private readonly viewerReady = computed(
    () => this.isVisible() && this.isInitialized() && !!this.pdfjsBundle,
  );
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
      },
      page: this.page(),
      stickToPage: this.stickToPage(),
      enableHandTool: this.enableHandTool(),
    };
  });

  private readonly syncTracker: SyncStateTracker = {
    lastReconfigureKey: '',
    lastEmittedDoc: null,
    getLatestScrolledPage: () => this.latestScrolledPage(),
    setLatestScrolledPage: (page) => this.latestScrolledPage.set(page),
  };

  constructor() {
    if (isSSR()) return;

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
        onLoadComplete: (doc) => this.afterLoadComplete.emit(doc),
        onError: (err) => this.onError.emit(err),
      });
    });

    this.setupAutoResize();
    this.setupFacadeEventHandlers();

    this.destroyRef.onDestroy(() => void this.cleanup());
  }

  ngAfterViewInit(): void {
    this.checkVisibilityAndInitialize();
  }

  private async checkVisibilityAndInitialize(): Promise<void> {
    const container = this.containerRef()?.nativeElement;
    if (!container) return;

    const isCurrentlyVisible = container.offsetParent !== null;
    if (this.isVisible() && !isCurrentlyVisible) {
      this.isVisible.set(false);
      return;
    }

    if (!this.isVisible() && isCurrentlyVisible) {
      this.isVisible.set(true);
      try {
        this.pdfjsBundle = await this.loader.load();
        const c = this.containerRef()?.nativeElement;
        if (c) await this.initializeViewer(c);
      } catch (error) {
        this.onError.emit(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  private async initializeViewer(container: HTMLDivElement): Promise<void> {
    if (!this.pdfjsBundle) return;

    const options: PdfViewerOptions = {
      renderText: this.renderText(),
      renderTextMode: this.renderTextMode(),
      showBorders: this.showBorders(),
      externalLinkTarget: this.externalLinkTarget(),
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
      },
    });

    this.isInitialized.set(true);
  }

  private async reconfigureViewer(config: ViewerSyncState['reconfigure']): Promise<void> {
    if (!this.pdfjsBundle) return;

    const container = this.containerRef()?.nativeElement;
    if (!container) return;

    await this.lifecycleService.reconfigure(
      this.facade,
      this.pdfjsBundle,
      container,
      config,
      { showBorders: this.showBorders(), externalLinkTarget: this.externalLinkTarget() },
      () => this.applyScaleUpdate(),
      (err) => this.onError.emit(err),
    );
  }

  private applyScaleUpdate(): void {
    const doc = this.currentDocument();
    const container = this.containerRef()?.nativeElement;
    const viewer = this.facade.getPdfViewer();
    if (!doc || !container || !viewer) return;

    const scaleConfig = this.getScaleConfig();
    const page = normalizePageNumber(this.page(), doc.numPages);
    const context: ScaleContext = {
      container,
      doc,
      viewer,
      stickToPage: this.stickToPage(),
      onError: (err) => this.onError.emit(err),
    };
    this.scaleService.updateScaleAndRender(this.facade, context, scaleConfig, page);
  }

  private async loadPdf(): Promise<void> {
    const src = this.src();
    if (!src || !this.pdfjsBundle) return;

    const cMapsUrl = this.facade.getCMapsUrl(this.cMapsUrl(), this.pdfjsBundle.lib.version);
    await this.facade.loadDocument(src, cMapsUrl, this.pdfjsBundle);
  }

  private setupAutoResize(): void {
    if (isSSR()) return;

    fromEvent(window, 'resize')
      .pipe(
        filter(() => this.autoresize() && !!this.currentDocument()),
        debounceTime(RESIZE_DEBOUNCE_TIME),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.applyScaleUpdate());

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        if (this.autoresize() && this.currentDocument()) this.applyScaleUpdate();
      });
      observer.observe(this.hostElement.nativeElement);
      this.destroyRef.onDestroy(() => observer.disconnect());
    }
  }

  private setupFacadeEventHandlers(): void {
    effect(() => {
      const err = this.facade.loadError();
      if (err) this.onError.emit(err);
    });

    effect(() => {
      const progress = this.facade.loadProgress();
      if (progress) this.onProgress.emit(progress);
    });
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

    if (this.handToolCleanup) {
      this.handToolCleanup();
      this.handToolCleanup = null;
    }
    this.handToolCleanup = setupHandTool(container, enabled);
  }

  private async cleanup(): Promise<void> {
    if (this.handToolCleanup) {
      this.handToolCleanup();
      this.handToolCleanup = null;
    }
    this.syncTracker.lastReconfigureKey = '';
    this.syncTracker.lastEmittedDoc = null;
    await this.facade.cleanup();
  }
}
