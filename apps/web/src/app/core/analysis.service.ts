import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import {
  InputFormat,
  KeyRequirementsSummary,
  OverlapFlag,
  UserStory,
} from '@smart-backlog/shared';
import { SessionService } from './session.service';

export interface RegenerateDto {
  targetType: 'story' | 'task';
  targetId: string;
  parentStoryId?: string;
  feedback: string;
}

type ProgressEvent = { type: 'progress'; step: string };
type SummaryEvent = { type: 'summary'; payload: KeyRequirementsSummary };
type StoryEvent = { type: 'story'; payload: UserStory };
type OverlapUpdateEvent = { type: 'overlap_update'; storyId: string; flag: OverlapFlag; reference: string | null };
type ErrorEvent = { type: 'error'; payload: { code: string; message: string } };

export type AnalysisSseEvent = ProgressEvent | SummaryEvent | StoryEvent | OverlapUpdateEvent | ErrorEvent;

@Injectable({ providedIn: 'root' })
export class AnalysisService {
  readonly currentStep$ = new BehaviorSubject<string | null>(null);

  constructor(private readonly session: SessionService) {}

  startAnalysis(formData: FormData): void {
    const inputType = formData.get('inputType') as string;
    const pdfFile = formData.get('pdfFile') as File | null;
    const textContent = (formData.get('textContent') as string | null) ?? '';
    const wordCount = inputType === 'text' ? textContent.trim().split(/\s+/).filter(Boolean).length : 0;

    this.session.startAnalysis(
      {
        id: uuidv4(),
        format: inputType === 'pdf' ? InputFormat.PDF : InputFormat.Text,
        rawContent: inputType === 'text' ? textContent : '',
        filename: pdfFile?.name ?? null,
        wordCount,
        segmentCount: Math.max(1, Math.ceil(wordCount / 5000)),
        submittedAt: new Date().toISOString(),
      },
      []
    );

    this.currentStep$.next(null);
    this.streamSse('/api/analyse', formData, event => this.handleAnalysisEvent(event))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.session.setAnalysisError({ code: 'NETWORK_ERROR', message });
      });
  }

  regenerate(dto: RegenerateDto): void {
    const body = new FormData();
    body.append('targetType', dto.targetType);
    body.append('targetId', dto.targetId);
    body.append('feedback', dto.feedback);
    if (dto.parentStoryId) body.append('parentStoryId', dto.parentStoryId);

    this.streamSse('/api/regenerate', body, event => this.handleRegenerateEvent(event, dto))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.session.setAnalysisError({ code: 'NETWORK_ERROR', message });
      });
  }

  private handleAnalysisEvent(event: AnalysisSseEvent): void {
    switch (event.type) {
      case 'progress':
        this.currentStep$.next(event.step);
        if (event.step === 'complete') {
          this.session.setAnalysisComplete({});
        }
        break;
      case 'summary':
        this.session.setRequirementsSummary(event.payload);
        break;
      case 'story':
        this.session.appendStory(event.payload);
        break;
      case 'overlap_update':
        this.session.patchStoryOverlap(event.storyId, event.flag, event.reference);
        break;
      case 'error':
        this.session.setAnalysisError(event.payload);
        break;
    }
  }

  private handleRegenerateEvent(event: AnalysisSseEvent, dto: RegenerateDto): void {
    switch (event.type) {
      case 'story':
        this.session.replaceStory(dto.targetId, event.payload);
        break;
      case 'error':
        this.session.setAnalysisError(event.payload);
        break;
    }
  }

  private async streamSse(url: string, body: FormData, onEvent: (e: AnalysisSseEvent) => void): Promise<void> {
    let response: Response;
    try {
      response = await fetch(url, { method: 'POST', body });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not connect to the analysis service';
      this.session.setAnalysisError({ code: 'NETWORK_ERROR', message });
      return;
    }

    if (!response.ok) {
      this.session.setAnalysisError({ code: 'HTTP_ERROR', message: `Server returned ${response.status}` });
      return;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/event-stream')) {
      this.session.setAnalysisError({
        code: 'HTTP_ERROR',
        message: `Expected SSE stream but got ${contentType || 'unknown content type'} — is the API server running and the proxy configured?`,
      });
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      this.session.setAnalysisError({ code: 'NETWORK_ERROR', message: 'Response body is not readable' });
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let receivedAnyEvent = false;

    try {
      for (;;) {
        let chunk: ReadableStreamReadResult<Uint8Array>;
        try {
          chunk = await reader.read();
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Stream read error';
          this.session.setAnalysisError({ code: 'NETWORK_ERROR', message });
          return;
        }

        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6)) as AnalysisSseEvent;
              receivedAnyEvent = true;
              onEvent(parsed);
            } catch { /* skip malformed lines */ }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (!receivedAnyEvent) {
      this.session.setAnalysisError({ code: 'NETWORK_ERROR', message: 'Analysis service returned an empty response' });
    }
  }
}
