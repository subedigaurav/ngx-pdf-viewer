import type { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import type { EventBus } from '../models/pdfjs-api.model';

interface EventForwardRule {
  event: string;
  target: 'window' | 'container';
  detail?: string[];
  customEventName?: (payload: Record<string, unknown>) => string;
}

const DEFAULT_FORWARD_RULES: EventForwardRule[] = [
  { event: 'documentload', target: 'window' },
  { event: 'pagerendered', target: 'container', detail: ['pageNumber', 'cssTransform'] },
  { event: 'textlayerrendered', target: 'container', detail: ['pageNumber'] },
  { event: 'pagechanging', target: 'container', detail: ['pageNumber'] },
  { event: 'pagesinit', target: 'container' },
  { event: 'pagesloaded', target: 'container', detail: ['pagesCount'] },
  { event: 'scalechange', target: 'container', detail: ['scale', 'presetValue'] },
];

function extractEventDetail(payload: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.filter((key) => payload[key] !== undefined).map((key) => [key, payload[key]]));
}

function forwardEventToDom(
  eventBus: EventBus,
  rule: EventForwardRule,
  container: HTMLElement,
  destroyRef: DestroyRef,
): void {
  fromEvent(eventBus, rule.event)
    .pipe(takeUntilDestroyed(destroyRef))
    .subscribe((event: unknown) => {
      const payload = event as Record<string, unknown>;
      const target = rule.target === 'window' ? window : container;

      const eventName = rule.customEventName?.(payload) ?? rule.event;
      const detail = rule.detail ? extractEventDetail(payload, rule.detail) : {};

      target.dispatchEvent(
        new CustomEvent(eventName, {
          bubbles: true,
          cancelable: true,
          detail,
        }),
      );
    });
}

export function createEventBus(
  EventBusConstructor: new () => EventBus,
  container: HTMLElement,
  destroyRef: DestroyRef,
): EventBus {
  const eventBus = new EventBusConstructor();

  for (const rule of DEFAULT_FORWARD_RULES) {
    forwardEventToDom(eventBus, rule, container, destroyRef);
  }

  return eventBus;
}
