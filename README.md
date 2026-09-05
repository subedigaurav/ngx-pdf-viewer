# ngx-pdf-viewer

[![Deploy Docs](https://github.com/subedigaurav/ngx-pdf-viewer/actions/workflows/github-pages.yml/badge.svg)](https://github.com/subedigaurav/ngx-pdf-viewer/actions/workflows/github-pages.yml)
[![Angular](https://img.shields.io/badge/Angular-21+-DD0031?logo=angular)](https://angular.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-14b8a6.svg)](#license)

Headless, signal-based PDF viewer for Angular 21+, powered by [pdfjs-dist](https://github.com/mozilla/pdf.js) — loaded from a CDN automatically, no separate install or wiring. No toolbar chrome, no NgModules — bring your own UI and get a fully typed, SSR-safe viewer API.

## Quick Start

```bash
npm install @gavsby/ngx-pdf-viewer
```

```typescript
import { Component } from '@angular/core';
import { PdfViewerComponent } from '@gavsby/ngx-pdf-viewer';

@Component({
  selector: 'app-document-viewer',
  standalone: true,
  imports: [PdfViewerComponent],
  template: ` <ngx-pdf-viewer [src]="src" (afterLoadComplete)="loaded($event)" (error)="failed($event)" /> `,
})
export class DocumentViewerComponent {
  src = '/assets/document.pdf';
  loaded(doc: unknown): void {}
  failed(err: unknown): void {}
}
```

## Features

- **Lazy init via IntersectionObserver** — pdf.js only loads when the viewer enters the viewport
- **Fit modes** — `page-width`, `page-height`, `page-fit` plus manual zoom and original size
- **Rotation** — rotate pages in 90° increments
- **Text layer** — selectable/searchable text
- **Annotations & forms** — configurable annotation display mode
- **Password support** — async `passwordProvider` input for encrypted documents
- **Search / print / download / outline APIs** — programmatic control from the host component
- **SSR-safe** — the component no-ops on the server; safe for Angular Universal

## Documentation

Full guides and API reference: **https://subedigaurav.github.io/ngx-pdf-viewer/**

- [Getting Started](https://subedigaurav.github.io/ngx-pdf-viewer/docs/getting-started) — install, host sizing, self-hosting pdf.js
- [API Reference](https://subedigaurav.github.io/ngx-pdf-viewer/docs/api) — every input, output and method

## Repo layout

This is a pnpm workspace with two projects:

- [`projects/ngx-pdf-viewer`](projects/ngx-pdf-viewer) — the published library ([`@gavsby/ngx-pdf-viewer`](https://www.npmjs.com/package/@gavsby/ngx-pdf-viewer))
- `projects/ngx-pdf-web` — the demo + docs site, deployed to GitHub Pages

## License

MIT
