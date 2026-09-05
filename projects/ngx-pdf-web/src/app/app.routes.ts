import { Routes } from '@angular/router';
import { MainLayoutComponent } from './layout/main-layout.component';

export const routes: Routes = [
  { path: '', redirectTo: '/demo', pathMatch: 'full' },
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      {
        path: 'demo',
        loadComponent: () => import('./demo/demo.component').then((m) => m.DemoComponent),
        title: 'demo - ngx-pdf-viewer',
      },
      {
        path: 'docs',
        children: [
          { path: '', redirectTo: 'overview', pathMatch: 'full' },
          {
            path: 'overview',
            loadComponent: () => import('./docs/overview/overview.component').then((m) => m.OverviewComponent),
            title: 'overview - ngx-pdf-viewer',
          },
          {
            path: 'getting-started',
            loadComponent: () =>
              import('./docs/getting-started/getting-started.component').then((m) => m.GettingStartedComponent),
            title: 'getting started - ngx-pdf-viewer',
          },
          {
            path: 'features',
            loadComponent: () => import('./docs/features/features.component').then((m) => m.FeaturesComponent),
            title: 'features - ngx-pdf-viewer',
          },
          {
            path: 'api',
            loadComponent: () => import('./docs/api/api.component').then((m) => m.ApiComponent),
            title: 'api reference - ngx-pdf-viewer',
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '/demo' },
];
