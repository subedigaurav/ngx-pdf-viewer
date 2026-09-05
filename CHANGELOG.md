# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-09-05

First stable release.

### Added

- `PdfViewerComponent` (`<ngx-pdf-viewer>`) — a standalone, headless PDF viewer built on PDF.js 6. Renders the document only; the toolbar's markup, styling, and accessibility are entirely yours.
- `[src]` accepts a URL string, `Uint8Array`, or `PDFSource` object — pass bytes directly to sidestep CORS entirely. Password-protected documents are supported via `[passwordProvider]`.
- Reactive zoom, rotation, fit-to-page/original-size, and page navigation, all driven by signal inputs (`zoom`, `zoomScale`, `rotation`, `page`, `fitToPage`, `originalSize`, `autoresize`).
- Pan/hand-tool support (`enableHandTool`) and configurable external link handling (`externalLinkTarget`).
- Selectable text-layer rendering (`renderText`, `renderTextMode`) and annotation display modes, including interactive form fields (`annotationMode`).
- Imperative document actions via `@ViewChild`: `search` / `findNext` / `findPrevious` / `clearSearch`, `getOutline` / `navigateToOutline`, `getMetadata`, `getThumbnail`, `getPageCount`, `download`, and `print`.
- Lifecycle and interaction outputs: `afterLoadComplete`, `error`, `progress`, `pageChange`, `pageRendered`, `pagesInitialized`, `textLayerRendered`, `outlineLoaded`, `searchResults`.
- Locale support (`locale`) and a custom `loadingTemplate` for the pre-render state.
- Lazy initialization via `IntersectionObserver` — PDF.js loads and the viewer renders only once scrolled into view.
- SSR-safe by default — no-ops on the server, safe for Angular Universal / Angular SSR.
- Automatic PDF.js delivery from a CDN (jsDelivr) at runtime, with `providePdfViewerConfig` to override the worker, cMaps, standard fonts, ICC profiles, or WASM URLs for self-hosted deployments.
- Fully typed public API: `PDFSource`, `PdfViewerError` with a `code`-based error model (`PdfViewerErrorCode`), `RenderTextMode`, and PDF.js document/page proxy types re-exported for convenience.

[1.0.0]: https://github.com/subedigaurav/ngx-pdf-viewer/releases/tag/v1.0.0
