import type { DestroyRef } from '@angular/core';
import { describe, expect, it } from 'vitest';
import type { EventBus } from '../models/pdfjs-api.model';
import { createEventBus } from './pdf-event-bus';

/**
 * EventTarget-backed fake that mirrors PDF.js EventBus semantics:
 * dispatch(name, data) assigns payload properties directly onto the event.
 */
class FakeEventBus extends EventTarget implements EventBus {
  on(eventName: string, listener: (event: unknown) => void): void {
    this.addEventListener(eventName, listener as EventListener);
  }

  off(eventName: string, listener: (event: unknown) => void): void {
    this.removeEventListener(eventName, listener as EventListener);
  }

  dispatch(eventName: string, data?: Record<string, unknown>): void {
    const event = new CustomEvent(eventName);
    Object.assign(event, data ?? {});
    this.dispatchEvent(event);
  }
}

function makeDestroyRef(): { destroyRef: DestroyRef; cleanups: (() => void)[] } {
  const cleanups: (() => void)[] = [];
  return {
    cleanups,
    destroyRef: { onDestroy: (fn: () => void) => cleanups.push(fn) } as unknown as DestroyRef,
  };
}

describe('createEventBus', () => {
  it('returns an EventTarget-like bus with on/off/dispatch', () => {
    const { destroyRef } = makeDestroyRef();
    const bus = createEventBus(FakeEventBus, document.createElement('div'), destroyRef);
    expect(bus).toBeInstanceOf(EventTarget);
    expect(typeof bus.on).toBe('function');
    expect(typeof bus.off).toBe('function');
    expect(typeof bus.dispatch).toBe('function');
  });

  it('forwards pagerendered to the container with filtered detail', () => {
    const { destroyRef } = makeDestroyRef();
    const container = document.createElement('div');
    const received: CustomEvent[] = [];
    container.addEventListener('pagerendered', (e) => received.push(e as CustomEvent));

    const bus = createEventBus(FakeEventBus, container, destroyRef);
    bus.dispatch('pagerendered', {
      pageNumber: 2,
      cssTransform: true,
      source: { irrelevant: true },
    });

    expect(received.length).toBe(1);
    expect(received[0].detail).toEqual({ pageNumber: 2, cssTransform: true });
  });

  it('forwards documentload to window', () => {
    const { destroyRef } = makeDestroyRef();
    const received: Event[] = [];
    window.addEventListener('documentload', (e) => received.push(e));

    const bus = createEventBus(FakeEventBus, document.createElement('div'), destroyRef);
    bus.dispatch('documentload', {});

    expect(received.length).toBe(1);
  });

  it('forwards pagechanging/textlayerrendered/pagesinit details', () => {
    const { destroyRef } = makeDestroyRef();
    const container = document.createElement('div');
    const pageChanges: CustomEvent[] = [];
    const textLayer: CustomEvent[] = [];
    const pagesInit: CustomEvent[] = [];
    container.addEventListener('pagechanging', (e) => pageChanges.push(e as CustomEvent));
    container.addEventListener('textlayerrendered', (e) => textLayer.push(e as CustomEvent));
    container.addEventListener('pagesinit', (e) => pagesInit.push(e as CustomEvent));

    const bus = createEventBus(FakeEventBus, container, destroyRef);
    bus.dispatch('pagechanging', { pageNumber: '3' });
    bus.dispatch('textlayerrendered', { pageNumber: 5, source: null });
    bus.dispatch('pagesinit', {});

    expect(pageChanges[0].detail).toEqual({ pageNumber: '3' });
    expect(textLayer[0].detail).toEqual({ pageNumber: 5 });
    expect(pagesInit[0].detail).toEqual({});
  });

  it('detaches listeners cleanly after destroyRef teardown (no throws, no emissions)', () => {
    const { destroyRef, cleanups } = makeDestroyRef();
    const container = document.createElement('div');
    const received: CustomEvent[] = [];
    container.addEventListener('pagerendered', (e) => received.push(e as CustomEvent));

    const bus = createEventBus(FakeEventBus, container, destroyRef);
    for (const cleanup of cleanups) cleanup();

    expect(() => bus.dispatch('pagerendered', { pageNumber: 9 })).not.toThrow();
    expect(received.length).toBe(0);
  });
});
