# ngx-pdf-viewer

A lightweight PDF viewer library for angular applications.

[![Angular](https://img.shields.io/badge/Angular-21+-DD0031?logo=angular)](https://angular.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org/)

## Features

- **Angular 21+** — Built for modern Angular applications
- **Lightweight** — Minimal dependencies, optimized bundle size
- **Type-safe** — Full TypeScript support
- **Standalone** — Uses Angular standalone components (no NgModules required)

## Installation

```bash
pnpm add @subedigaurav/ngx-pdf-viewer
```

Or with npm:

```bash
npm install @subedigaurav/ngx-pdf-viewer
```

## Usage

Import the standalone component in your Angular application:

```typescript
import { PdfViewerComponent } from '@subedigaurav/ngx-pdf-viewer';

@Component({
  selector: 'app-document-viewer',
  standalone: true,
  imports: [PdfViewerComponent],
  template: `<ngx-pdf-viewer [src]="pdfSrc"></ngx-pdf-viewer>`,
})
export class DocumentViewerComponent {
  pdfSrc = 'https://example.com/document.pdf';
}
```
