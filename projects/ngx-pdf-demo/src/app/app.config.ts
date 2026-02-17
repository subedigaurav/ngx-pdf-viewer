import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { providePdfViewerConfig } from '@subedigaurav/ngx-pdf-viewer';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    providePdfViewerConfig({ version: '5.4.624' }),
  ],
};
