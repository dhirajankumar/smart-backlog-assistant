import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LIMITS } from '@smart-backlog/shared';
import { AnalysisService } from '../../core/analysis.service';

@Component({
  standalone: true,
  selector: 'app-input',
  imports: [CommonModule, FormsModule],
  templateUrl: './input.component.html',
  styleUrl: './input.component.scss',
})
export class InputComponent {
  readonly MAX_PDF_BYTES = LIMITS.MAX_PDF_SIZE_BYTES;

  inputMode: 'text' | 'pdf' = 'text';
  textContent = '';
  pdfFile: File | null = null;
  backlogFile: File | null = null;
  pdfError: string | null = null;
  isSubmitting = false;

  constructor(
    private readonly router: Router,
    private readonly analysisService: AnalysisService,
  ) {}

  setMode(mode: 'text' | 'pdf'): void {
    this.inputMode = mode;
    this.pdfError = null;
  }

  onPdfSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.pdfError = null;
    if (file && file.size > this.MAX_PDF_BYTES) {
      this.pdfError = `File must be ≤ 10 MB (selected: ${(file.size / 1_048_576).toFixed(1)} MB)`;
      this.pdfFile = null;
      input.value = '';
      return;
    }
    this.pdfFile = file;
  }

  onBacklogSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.backlogFile = input.files?.[0] ?? null;
  }

  get canSubmit(): boolean {
    if (this.inputMode === 'pdf') return this.pdfFile !== null && !this.pdfError;
    return this.textContent.trim().length > 0;
  }

  onSubmit(): void {
    if (!this.canSubmit || this.isSubmitting) return;

    this.isSubmitting = true;
    const formData = new FormData();
    if (this.inputMode === 'pdf') {
      formData.append('inputType', 'pdf');
      formData.append('pdfFile', this.pdfFile!);
    } else {
      formData.append('inputType', 'text');
      formData.append('textContent', this.textContent);
    }
    if (this.backlogFile) {
      formData.append('backlogJson', this.backlogFile);
    }

    this.analysisService.startAnalysis(formData);
    void this.router.navigate(['/analysis']);
  }
}
