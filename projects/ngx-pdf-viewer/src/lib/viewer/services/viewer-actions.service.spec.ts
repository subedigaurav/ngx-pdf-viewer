import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import type { PDFDocumentProxy } from '../../core/models/pdf-document.model';
import { PdfViewerError } from '../../core/models/viewer-error.model';
import { PdfViewerFacadeService } from './viewer-facade.service';
import { PdfViewerDocumentActionsService } from './viewer-actions.service';

describe('PdfViewerDocumentActionsService', () => {
  function setup(document: PDFDocumentProxy | null = null): PdfViewerDocumentActionsService {
    const navigateToDestination = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        PdfViewerDocumentActionsService,
        {
          provide: PdfViewerFacadeService,
          useValue: { currentDocument: signal(document), navigateToDestination },
        },
      ],
    });
    return TestBed.inject(PdfViewerDocumentActionsService);
  }

  it('normalizes missing outline titles and child items', async () => {
    const document = {
      numPages: 2,
      getOutline: async () => [{ title: null, items: [{ title: undefined, items: null }] }],
    } as unknown as PDFDocumentProxy;
    const service = setup(document);

    await expect(service.getOutline()).resolves.toEqual([{ title: '', items: [{ title: '', items: [] }] }]);
  });

  it('returns document metadata', async () => {
    const document = {
      getMetadata: async () => ({ info: { Title: 'Guide' }, metadata: null }),
    } as unknown as PDFDocumentProxy;
    const service = setup(document);

    await expect(service.getMetadata()).resolves.toEqual({
      info: { Title: 'Guide' },
      metadata: null,
    });
  });

  it('reports zero pages when no document is loaded', () => {
    expect(setup().getPageCount()).toBe(0);
  });

  it('navigates to an outline destination through the facade', () => {
    const navigateToDestination = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        PdfViewerDocumentActionsService,
        {
          provide: PdfViewerFacadeService,
          useValue: { currentDocument: signal(null), navigateToDestination },
        },
      ],
    });
    const service = TestBed.inject(PdfViewerDocumentActionsService);
    const destination = ['page-ref', { num: 2 }];

    service.navigateToOutline({ title: 'Chapter 1', dest: destination, items: [] });

    expect(navigateToDestination).toHaveBeenCalledWith(destination);
  });

  it('rejects document actions when no document is loaded', async () => {
    await expect(setup().getOutline()).rejects.toBeInstanceOf(PdfViewerError);
  });
});
