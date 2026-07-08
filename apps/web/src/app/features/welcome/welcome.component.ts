import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-welcome',
  imports: [CommonModule],
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.scss',
})
export class WelcomeComponent {
  isCopied = false;
  terminalLaunching = false;
  terminalError: string | null = null;

  constructor(private readonly router: Router) {}

  goToInput(): void {
    void this.router.navigate(['/input']);
  }
}
