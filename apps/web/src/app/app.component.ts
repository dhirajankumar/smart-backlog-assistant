import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { GithubConnectionBadgeComponent } from './shared/components/github-connection-badge/github-connection-badge.component';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, GithubConnectionBadgeComponent],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'web';
}
