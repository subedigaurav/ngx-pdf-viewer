import { ApplicationConfig, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withViewTransitions } from '@angular/router';

import { routes } from './app.routes';

/** Restores the deep link that public/404.html encoded before redirecting. */
function restoreGhPagesRedirect(): void {
  if (typeof window === 'undefined') return;
  const match = window.location.search.match(/[?&]__gh_redirect=([^&]+)/);
  if (!match) return;
  const base = '/ngx-pdf-viewer/';
  window.history.replaceState(null, '', base + decodeURIComponent(match[1]) + window.location.hash);
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
      withComponentInputBinding(),
      withViewTransitions(),
    ),
    provideAppInitializer(restoreGhPagesRedirect),
  ],
};
