import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  { path: '', redirectTo: 'welcome', pathMatch: 'full' },
  {
    path: 'welcome',
    loadComponent: () =>
      import('./features/welcome/welcome.component').then(m => m.WelcomeComponent),
  },
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
  {
    path: 'review',
    loadComponent: () =>
      import('./features/review/review.component').then(m => m.ReviewComponent),
  },
  {
    path: 'tasks/:storyId',
    loadComponent: () =>
      import('./features/tasks/tasks.component').then(m => m.TasksComponent),
  },
  {
    path: 'publish',
    loadComponent: () =>
      import('./features/publish/publish.component').then(m => m.PublishComponent),
  },
  {
    path: 'backlog',
    loadComponent: () =>
      import('./features/backlog/backlog.component').then(m => m.BacklogComponent),
  },
  {
    path: 'settings/github-projects',
    loadComponent: () =>
      import('./features/settings/github-projects-config.component').then(m => m.GithubProjectsConfigComponent),
  },
];
