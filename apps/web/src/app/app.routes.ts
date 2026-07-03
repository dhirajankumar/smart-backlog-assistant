import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  { path: '', redirectTo: 'input', pathMatch: 'full' },
  {
    path: 'input',
    loadComponent: () =>
      import('./features/input/input.component').then(m => m.InputComponent),
  },
  {
    path: 'analysis',
    loadComponent: () =>
      import('./features/analysis/analysis.component').then(m => m.AnalysisComponent),
  },
];
