# ngx-pdf-viewer

Headless, signal-based PDF viewer for Angular — built on **PDF.js 6**. No iframe, full control over styling, accessibility and behavior.

[![npm](https://img.shields.io/npm/v/@gavsby/ngx-pdf-viewer?color=0B57D0)](https://www.npmjs.com/package/@gavsby/ngx-pdf-viewer)
[![Angular](https://img.shields.io/badge/Angular-21+-DD0031?logo=angular)](https://angular.dev)
[![pdf.js](https://img.shields.io/badge/pdf.js-6.x-ff6f00)](https://mozilla.github.io/pdf.js/)
[![License: MIT](https://img.shields.io/badge/License-MIT-111418.svg)](LICENSE)

[Live demo](https://subedigaurav.github.io/ngx-pdf-viewer) · [Docs](https://subedigaurav.github.io/ngx-pdf-viewer/docs/overview) · [API Reference](https://subedigaurav.github.io/ngx-pdf-viewer/docs/api) · [Changelog](https://github.com/subedigaurav/ngx-pdf-viewer/releases)

## Install

```bash
pnpm add @gavsby/ngx-pdf-viewer
# npm: npm install @gavsby/ngx-pdf-viewer
```

PDF.js loads automatically from a CDN (jsDelivr) at runtime — nothing else to install or wire up. See [Getting Started](https://subedigaurav.github.io/ngx-pdf-viewer/docs/getting-started) for host sizing and advanced overrides (self-hosting, custom worker/cMaps URLs, etc.).

## Quick start

```ts
import { PdfViewerComponent } from '@gavsby/ngx-pdf-viewer';

@Component({
  selector: 'app-docs',
  standalone: true,
  imports: [PdfViewerComponent],
  template: `
    <div style="height: 100vh">
      <ngx-pdf-viewer [src]="pdfSrc" (afterLoadComplete)="onLoaded($event)" (error)="onError($event)" />
    </div>
  `,
})
export class DocsComponent {
  pdfSrc = 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf';
  onLoaded(pdf: PDFDocumentProxy) { console.log(pdf.numPages); }
  onError(e: PdfViewerError) { console.error(e.code, e.message); }
}
```

`[src]` accepts `string | Uint8Array | PDFSource` — pass `Uint8Array` to avoid CORS entirely.

## Features

- **Standalone** — `imports: [PdfViewerComponent]`, no `NgModule`
- **Typed & strict** — `PDFSource`, `PdfViewerError{code}`, `RenderTextMode`
- **Lazy by default** — initializes when scrolled into view via `IntersectionObserver`
- **Search, thumbnails, outline, metadata, print, download** — all imperative, via `@ViewChild`
- **Headless** — renders the document only; you own the toolbar, so its markup and a11y are yours
- **SSR-safe** — no-ops on the server; safe for Angular Universal

Full input/output/method reference: **[API Reference](https://subedigaurav.github.io/ngx-pdf-viewer/docs/api)**.

## License

MIT © [subedigaurav](https://github.com/subedigaurav)
