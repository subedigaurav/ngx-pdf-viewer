import { describe, expect, it, vi } from 'vitest';
import { renderPageThumbnail } from './pdf-thumbnail';

describe('renderPageThumbnail', () => {
  it('renders viewport-scaled canvas and returns data URL', async () => {
    const canvas = document.createElement('canvas');
    const ctx2d = { drawImage: vi.fn() };
    const getContextSpy = vi.spyOn(canvas, 'getContext').mockReturnValue(ctx2d as never);
    const toDataUrlSpy = vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,fake');
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(canvas as never);
    const viewportAt = (s: number) => ({ width: 100 * s, height: 200 * s, scale: s, rotation: 0 });
    const page = {
      pageNumber: 1,
      rotate: 0,
      getViewport: ({ scale }: { scale: number }) => viewportAt(scale),
      render: () => ({ promise: Promise.resolve(), cancel: () => {} }),
    };
    const result = await renderPageThumbnail(page as never, 25);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(typeof result.url).toBe('string');
    getContextSpy.mockRestore();
    toDataUrlSpy.mockRestore();
    createElementSpy.mockRestore();
  });
});
