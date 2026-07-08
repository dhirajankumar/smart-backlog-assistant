import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';

interface RoadmapPhase {
  id: string;
  label: string;
  description: string;
  available: boolean;
}

const MVP1_ROADMAP: RoadmapPhase[] = [
  {
    id: 'backlog-refinement',
    label: 'AI Backlog Refinement',
    description: 'Automatically refine and decompose requirements into actionable user stories with acceptance criteria.',
    available: true,
  },
  {
    id: 'story-review',
    label: 'Story Review & Approval',
    description: 'Review, amend, and approve AI-generated stories before they enter your backlog.',
    available: true,
  },
  {
    id: 'requirements',
    label: 'Requirements Refinement',
    description: 'Structured elicitation and refinement of raw requirements into validated, prioritised inputs.',
    available: false,
  },
  {
    id: 'feature-spec',
    label: 'Feature Specification',
    description: 'Generate formal feature specs with traceability from requirements to user stories.',
    available: false,
  },
  {
    id: 'planning',
    label: 'Planning',
    description: 'Technical architecture and implementation planning driven by the feature specification.',
    available: false,
  },
  {
    id: 'task-generation',
    label: 'Task Generation',
    description: 'Automatic breakdown of planned work into dependency-ordered, story-linked tasks.',
    available: false,
  },
];

@Component({
  standalone: true,
  selector: 'app-welcome',
  imports: [CommonModule, MatTabsModule],
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.scss',
})
export class WelcomeComponent {
  isCopied = false;
  terminalLaunching = false;
  terminalError: string | null = null;

  constructor(private readonly router: Router) {}

  get currentPhases(): RoadmapPhase[] {
    return MVP1_ROADMAP.filter(p => p.available);
  }

  get upcomingPhases(): RoadmapPhase[] {
    return MVP1_ROADMAP.filter(p => !p.available);
  }

  goToInput(): void {
    void this.router.navigate(['/input']);
  }
}
