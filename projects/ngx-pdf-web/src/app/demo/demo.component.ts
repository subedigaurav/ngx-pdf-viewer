import { Combobox, ComboboxPopup, ComboboxWidget } from '@angular/aria/combobox';
import { Listbox, Option } from '@angular/aria/listbox';
import { Toolbar, ToolbarWidget, ToolbarWidgetGroup } from '@angular/aria/toolbar';
import { Component, computed, effect, ElementRef, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  PdfViewerComponent,
  RenderTextMode,
  type PDFDocumentProxy,
  type PDFProgressData,
  type PdfSearchMatches,
} from '@gavsby/ngx-pdf-viewer';

type ZoomScale = 'page-width' | 'page-height' | 'page-fit';
type ExternalLinkTarget = 'blank' | 'none' | 'self' | 'parent' | 'top';

const DEFAULT_PDF_URL = 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf';

@Component({
  selector: 'ngx-demo',
  standalone: true,
  imports: [
    PdfViewerComponent,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    Toolbar,
    ToolbarWidget,
    ToolbarWidgetGroup,
    Combobox,
    ComboboxPopup,
    ComboboxWidget,
    Listbox,
    Option,
  ],
  templateUrl: './demo.component.html',
  styles: [':host { display: block; position: absolute; inset: 0; }'],
})
export class DemoComponent {
  readonly viewer = viewChild(PdfViewerComponent);
  readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  readonly pdfSrc = signal<string>(DEFAULT_PDF_URL);
  readonly urlDraft = signal<string>(DEFAULT_PDF_URL);
  readonly page = signal<number>(1);
  readonly renderText = signal(true);
  readonly renderTextMode = signal<RenderTextMode>(RenderTextMode.ENABLED);
  readonly originalSize = signal(false);
  readonly stickToPage = signal(false);
  readonly zoom = signal(1);
  readonly zoomScale = signal<ZoomScale>('page-width');
  readonly rotation = signal(0);
  readonly autoresize = signal(true);
  readonly fitToPage = signal(true);
  readonly showBorders = signal(false);
  readonly enableHandTool = signal(false);
  readonly externalLinkTarget = signal<ExternalLinkTarget>('blank');

  readonly numPages = signal(0);
  readonly currentPage = signal(1);
  readonly loadProgress = signal<{ loaded: number; total: number } | null>(null);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);

  readonly searchOpen = signal(false);
  readonly searchQuery = signal('');
  readonly searchMatches = signal<PdfSearchMatches | null>(null);

  readonly scaleOpen = signal(false);
  readonly modeOpen = signal(false);
  readonly linksOpen = signal(false);

  readonly renderTextModes = [
    { value: String(RenderTextMode.DISABLED), label: 'Disabled' },
    { value: String(RenderTextMode.ENABLED), label: 'Enabled' },
    { value: String(RenderTextMode.ENHANCED), label: 'Enhanced' },
  ] as const;

  readonly zoomScales: { value: ZoomScale; label: string }[] = [
    { value: 'page-width', label: 'Page width' },
    { value: 'page-height', label: 'Page height' },
    { value: 'page-fit', label: 'Page fit' },
  ];

  readonly linkTargets: { value: ExternalLinkTarget; label: string }[] = [
    { value: 'blank', label: 'New tab' },
    { value: 'self', label: 'Same window' },
    { value: 'parent', label: 'Parent' },
    { value: 'top', label: 'Top' },
    { value: 'none', label: 'None' },
  ];

  readonly zoomPercent = computed(() => Math.round(this.zoom() * 100));
  readonly zoomScaleLabel = computed(() => this.zoomScales.find((o) => o.value === this.zoomScale())?.label ?? 'Scale');
  readonly zoomScaleSelection = computed(() => [this.zoomScale()]);
  readonly renderTextModeSelection = computed(() => [String(this.renderTextMode())]);
  readonly linkTargetSelection = computed(() => [this.externalLinkTarget()]);
  readonly renderTextModeLabel = computed(
    () => this.renderTextModes.find((o) => o.value === String(this.renderTextMode()))?.label ?? 'Mode',
  );
  readonly linkTargetLabel = computed(
    () => this.linkTargets.find((o) => o.value === this.externalLinkTarget())?.label ?? 'Links',
  );

  readonly searchResultLabel = computed(() => {
    const matches = this.searchMatches();
    if (!matches) return null;
    return matches.total === 0 ? 'No results' : `${matches.current} of ${matches.total}`;
  });

  readonly progressPercent = computed(() => {
    const p = this.loadProgress();
    if (!p || p.total === 0) return null;
    return Math.round((p.loaded / p.total) * 100);
  });

  readonly canZoomOut = computed(() => this.zoom() > 0.5);
  readonly canZoomIn = computed(() => this.zoom() < 3);
  readonly hasDocument = computed(() => this.numPages() > 0 && !this.isLoading());

  constructor() {
    effect(() => {
      if (this.searchOpen()) {
        queueMicrotask(() => this.searchInput()?.nativeElement.focus());
      }
    });
  }

  onPageInput(value: string | number): void {
    if (value === '' || value === null || value === undefined) return;
    const n = typeof value === 'string' ? Number(value) : value;
    if (Number.isNaN(n)) return;
    const total = this.numPages() || 999;
    this.page.set(Math.max(1, Math.min(total, Math.round(n))));
  }

  applyPdfUrl(): void {
    const url = this.urlDraft().trim() || DEFAULT_PDF_URL;
    this.urlDraft.set(url);
    if (url === this.pdfSrc() && this.hasDocument() && !this.error()) return;

    this.error.set(null);
    this.isLoading.set(true);
    this.numPages.set(0);
    this.pdfSrc.set(url);
  }

  loadSamplePdf(): void {
    this.urlDraft.set(DEFAULT_PDF_URL);
    this.applyPdfUrl();
  }

  onLoadComplete(pdf: PDFDocumentProxy): void {
    this.numPages.set(pdf.numPages);
    this.loadProgress.set(null);
    this.isLoading.set(false);
    this.error.set(null);
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.page.set(page);
  }

  onProgress(data: PDFProgressData): void {
    this.loadProgress.set({ loaded: data.loaded, total: data.total });
  }

  onError(err: unknown): void {
    this.isLoading.set(false);
    this.error.set(err instanceof Error ? err.message : String(err));
  }

  goToPage(delta: number): void {
    const n = this.numPages();
    if (n === 0) return;
    const next = Math.max(1, Math.min(n, this.page() + delta));
    this.page.set(next);
  }

  zoomBy(delta: number): void {
    const next = Math.round((this.zoom() + delta) * 10) / 10;
    this.zoom.set(Math.max(0.5, Math.min(3, next)));
  }

  rotateClockwise(): void {
    this.rotation.update((r) => (r + 90) % 360);
  }

  toggleSearch(): void {
    const next = !this.searchOpen();
    this.searchOpen.set(next);
    if (!next) this.closeSearch();
  }

  runSearch(): void {
    const query = this.searchQuery().trim();
    if (!query) {
      this.viewer()?.clearSearch();
      return;
    }
    this.viewer()?.search(query);
  }

  onSearchQueryChange(query: string): void {
    this.searchQuery.set(query);
    this.runSearch();
  }

  findNext(): void {
    if (!this.searchQuery().trim()) return;
    this.viewer()?.findNext();
  }

  findPrevious(): void {
    if (!this.searchQuery().trim()) return;
    this.viewer()?.findPrevious();
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.shiftKey) {
        this.findPrevious();
      } else {
        this.findNext();
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.toggleSearch();
    }
  }

  closeSearch(): void {
    this.searchQuery.set('');
    this.searchMatches.set(null);
    this.viewer()?.clearSearch();
  }

  onSearchResults(matches: PdfSearchMatches | null): void {
    this.searchMatches.set(matches);
  }

  commitScale(values: string[]): void {
    const next = values[0] as ZoomScale | undefined;
    if (next) this.zoomScale.set(next);
    this.scaleOpen.set(false);
  }

  commitTextMode(values: string[]): void {
    const next = values[0];
    if (next !== undefined) this.renderTextMode.set(Number(next) as RenderTextMode);
    this.modeOpen.set(false);
  }

  commitLinkTarget(values: string[]): void {
    const next = values[0] as ExternalLinkTarget | undefined;
    if (next) this.externalLinkTarget.set(next);
    this.linksOpen.set(false);
  }

  async download(): Promise<void> {
    await this.viewer()?.download();
  }

  async print(): Promise<void> {
    await this.viewer()?.print();
  }
}
