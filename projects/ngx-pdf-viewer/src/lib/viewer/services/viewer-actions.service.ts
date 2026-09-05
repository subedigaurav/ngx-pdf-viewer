import { inject, Injectable } from '@angular/core';
import type { PDFDocumentMetadata, PDFDocumentProxy, PDFOutlineItem } from '../../core/models/pdf-document.model';
import { PdfViewerError } from '../../core/models/viewer-error.model';
import type { ThumbnailData } from '../../core/models/viewer.model';
import { downloadBytes, printBytes } from '../../core/utils/pdf-file-actions';
import { normalizePageNumber } from '../../core/utils/pdf-scale';
import { renderPageThumbnail } from '../../core/utils/pdf-thumbnail';
import { PdfViewerFacadeService } from './viewer-facade.service';

@Injectable()
export class PdfViewerDocumentActionsService {
  private readonly facade = inject(PdfViewerFacadeService);

  async getOutline(): Promise<PDFOutlineItem[]> {
    const document = this.getCurrentDocument();
    return this.normalizeOutlineItems(await document.getOutline());
  }

  async getMetadata(): Promise<PDFDocumentMetadata> {
    return this.getCurrentDocument().getMetadata();
  }

  navigateToOutline(item: PDFOutlineItem): void {
    this.facade.navigateToDestination(item.dest);
  }

  async getThumbnail(page: number): Promise<ThumbnailData> {
    const document = this.getCurrentDocument();
    const proxy = await document.getPage(normalizePageNumber(page, document.numPages));
    return renderPageThumbnail(proxy);
  }

  async download(filename?: string): Promise<void> {
    await downloadBytes(await this.getCurrentDocument().getData(), filename);
  }

  async print(): Promise<void> {
    await printBytes(await this.getCurrentDocument().getData());
  }

  getPageCount(): number {
    return this.facade.currentDocument()?.numPages ?? 0;
  }

  private getCurrentDocument(): PDFDocumentProxy {
    const document = this.facade.currentDocument();
    if (!document) throw new PdfViewerError('INVALID_STATE', 'No document loaded.');
    return document;
  }

  private normalizeOutlineItems(items?: PDFOutlineItem[] | null): PDFOutlineItem[] {
    return (items ?? []).map((item) => ({
      ...item,
      title: item.title ?? '',
      items: this.normalizeOutlineItems(item.items),
    }));
  }
}
