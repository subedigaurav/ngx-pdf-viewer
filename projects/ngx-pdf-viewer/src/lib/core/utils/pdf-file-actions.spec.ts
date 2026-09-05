import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadBytes, printBytes } from './pdf-file-actions';

describe('downloadBytes', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('creates an object URL, clicks the anchor, and revokes only once the browser can read it', async () => {
    vi.useFakeTimers();
    const revokeSpy = vi.fn();
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revokeSpy);
    const click = vi.fn();
    const anchor = { click, remove: vi.fn(), set href(v: string) {}, download: '' };
    vi.spyOn(document, 'createElement').mockReturnValue(anchor as never);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => anchor as never);

    await downloadBytes(new Uint8Array([1]), 'file.pdf');

    expect(createSpy).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(anchor.download).toBe('file.pdf');
    expect(revokeSpy).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(revokeSpy).toHaveBeenCalledWith('blob:x');
  });
});

describe('printBytes', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads blob into hidden iframe and calls print()', async () => {
    const printFn = vi.fn();
    const fakeWindow = { print: printFn };
    const fakeIframe: Record<string, unknown> = {};
    vi.spyOn(document, 'createElement').mockReturnValue({
      style: {},
      setAttribute: vi.fn(),
      ...fakeIframe,
    } as never);
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(((el: HTMLElement) => {
      (el as unknown as { contentWindow: unknown }).contentWindow = fakeWindow;
      // Fire onload asynchronously so printBytes does not wait out its 3s fallback timer.
      queueMicrotask(() => (el as unknown as { onload?: () => void }).onload?.());
      return el;
    }) as never);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:y');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as never);

    await printBytes(new Uint8Array([1]));

    expect(printFn).toHaveBeenCalledOnce();
    appendSpy.mockRestore();
  });
});
