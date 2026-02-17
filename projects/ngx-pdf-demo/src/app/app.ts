import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import {
  PdfViewerComponent,
  RenderTextMode,
  type PDFDocumentProxy,
  type PDFProgressData,
} from '@subedigaurav/ngx-pdf-viewer';

type ZoomScale = 'page-width' | 'page-height' | 'page-fit';
type ExternalLinkTarget = 'blank' | 'none' | 'self' | 'parent' | 'top';

const DEFAULT_PDF_URL = 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, PdfViewerComponent, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly pdfSrc = signal<string>(DEFAULT_PDF_URL);
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
  readonly error = signal<string | null>(null);
  readonly controlsOpen = signal(true);

  readonly renderTextModes = [
    { value: RenderTextMode.DISABLED, label: 'Disabled' },
    { value: RenderTextMode.ENABLED, label: 'Enabled' },
    { value: RenderTextMode.ENHANCED, label: 'Enhanced' },
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

  readonly pageInfo = computed(() => `${this.currentPage()} / ${this.numPages() || '—'}`);

  readonly progressPercent = computed(() => {
    const p = this.loadProgress();
    if (!p || p.total === 0) return null;
    return Math.round((p.loaded / p.total) * 100);
  });

  setPdfUrl(url: string): void {
    this.error.set(null);
    this.pdfSrc.set(url || DEFAULT_PDF_URL);
  }

  loadSamplePdf(): void {
    this.setPdfUrl(DEFAULT_PDF_URL);
  }

  onLoadComplete(pdf: PDFDocumentProxy): void {
    this.numPages.set(pdf.numPages);
    this.loadProgress.set(null);
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
    this.error.set(err instanceof Error ? err.message : String(err));
  }

  goToPage(delta: number): void {
    const n = this.numPages();
    if (n === 0) return;
    const next = Math.max(1, Math.min(n, this.page() + delta));
    this.page.set(next);
  }

  toggleControls(): void {
    this.controlsOpen.update((v) => !v);
  }
}
