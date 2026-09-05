import type { PDFPageProxy } from '../models/pdf-document.model';
import type { ThumbnailData } from '../models/viewer.model';

export const THUMBNAIL_MAX_WIDTH = 150;

export async function renderPageThumbnail(
  page: PDFPageProxy,
  maxWidth: number = THUMBNAIL_MAX_WIDTH,
): Promise<ThumbnailData> {
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = maxWidth / baseViewport.width;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context unavailable.');
  await page.render({ canvasContext: context, viewport, background: '#ffffff' }).promise;
  return { url: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
}
