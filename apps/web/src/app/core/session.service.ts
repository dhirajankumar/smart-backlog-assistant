import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import {
  ActionType,
  Confidence,
  ExistingBacklogItem,
  InputDocument,
  ItemStatus,
  KeyRequirementsSummary,
  MODEL_ID,
  OverlapFlag,
  PublishedBacklog,
  SessionState,
  SessionStatus,
  Task,
  UserStory,
} from '@smart-backlog/shared';
import { AuditService } from './audit.service';

const INITIAL_STATE: SessionState = {
  status: SessionStatus.Idle,
  inputDocument: null,
  existingBacklogItems: [],
  requirementsSummary: null,
  stories: [],
  tasks: {},
  activeStoryId: null,
  auditLog: [],
  analysisStartedAt: null,
  promptVersions: {},
  analysisError: null,
  reviewerName: null,
};

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly state = new BehaviorSubject<SessionState>({ ...INITIAL_STATE });

  readonly state$: Observable<SessionState> = this.state.asObservable();
  readonly status$ = this.state$.pipe(map(s => s.status));
  readonly stories$ = this.state$.pipe(map(s => s.stories));
  readonly requirementsSummary$ = this.state$.pipe(map(s => s.requirementsSummary));
  readonly analysisError$ = this.state$.pipe(map(s => s.analysisError));
  readonly approvedStories$ = this.state$.pipe(
    map(s => s.stories.filter(st => st.status === ItemStatus.Approved || st.status === ItemStatus.Amended))
  );
  readonly pendingStories$ = this.state$.pipe(
    map(s => s.stories.filter(st => st.status === ItemStatus.Draft))
  );
  readonly rejectedStories$ = this.state$.pipe(
    map(s => s.stories.filter(st => st.status === ItemStatus.Rejected))
  );
  readonly canPublish$ = this.state$.pipe(
    map(s => s.stories.some(st => st.status === ItemStatus.Approved || st.status === ItemStatus.Amended))
  );
  readonly lowConfidenceItems$ = this.state$.pipe(
    map(s => {
      const stories: (UserStory | Task)[] = s.stories.filter(st => st.confidence === Confidence.Low);
      const tasks: (UserStory | Task)[] = Object.values(s.tasks).flat().filter(t => t.confidence === Confidence.Low);
      return [...stories, ...tasks];
    })
  );
  readonly reviewSummary$ = this.state$.pipe(
    map(s => ({
      approved: s.stories.filter(st => st.status === ItemStatus.Approved).length,
      amended: s.stories.filter(st => st.status === ItemStatus.Amended).length,
      rejected: s.stories.filter(st => st.status === ItemStatus.Rejected).length,
      pending: s.stories.filter(st => st.status === ItemStatus.Draft).length,
    }))
  );

  constructor(private readonly audit: AuditService) {}

  tasksForStory$(id: string): Observable<Task[]> {
    return this.state$.pipe(map(s => s.tasks[id] ?? []));
  }

  approvedTasksForStory$(id: string): Observable<Task[]> {
    return this.state$.pipe(
      map(s => (s.tasks[id] ?? []).filter(t => t.status === ItemStatus.Approved || t.status === ItemStatus.Amended))
    );
  }

  startAnalysis(input: InputDocument, backlogItems: ExistingBacklogItem[]): void {
    this.state.next({
      ...INITIAL_STATE,
      status: SessionStatus.Analysing,
      inputDocument: input,
      existingBacklogItems: backlogItems,
      analysisStartedAt: Date.now(),
    });
  }

  setRequirementsSummary(summary: KeyRequirementsSummary): void {
    const s = this.state.getValue();
    this.state.next({ ...s, requirementsSummary: summary });
  }

  appendStory(story: UserStory): void {
    const s = this.state.getValue();
    this.state.next({ ...s, stories: [...s.stories, story] });
  }

  patchStoryOverlap(storyId: string, flag: OverlapFlag, reference: string | null): void {
    const s = this.state.getValue();
    this.state.next({
      ...s,
      stories: s.stories.map(st => st.id === storyId ? { ...st, overlapFlag: flag, overlapReference: reference } : st),
    });
  }

  setAnalysisComplete(promptVersions: Record<string, string>): void {
    const s = this.state.getValue();
    this.state.next({ ...s, status: SessionStatus.Review, promptVersions, analysisStartedAt: null });
  }

  setAnalysisError(error: { code: string; message: string }): void {
    const s = this.state.getValue();
    this.state.next({ ...s, status: SessionStatus.Error, analysisError: error });
  }

  approveStory(id: string): void {
    const s = this.state.getValue();
    const record = this.audit.createAction({ actionType: ActionType.Approve, targetType: 'story', targetId: id, content: null });
    this.state.next({
      ...s,
      stories: s.stories.map(st => st.id === id ? { ...st, status: ItemStatus.Approved } : st),
      auditLog: [...s.auditLog, record],
    });
  }

  rejectStory(id: string, reason?: string): void {
    const s = this.state.getValue();
    const record = this.audit.createAction({ actionType: ActionType.Reject, targetType: 'story', targetId: id, content: reason ?? null });
    this.state.next({
      ...s,
      stories: s.stories.map(st => st.id === id ? { ...st, status: ItemStatus.Rejected } : st),
      auditLog: [...s.auditLog, record],
    });
  }

  amendStory(
    id: string,
    patch: Partial<Pick<UserStory, 'title' | 'role' | 'benefit' | 'acceptanceCriteria' | 'priority' | 'category'>>
  ): void {
    const s = this.state.getValue();
    const original = s.stories.find(st => st.id === id);
    if (!original) return;
    const { status: _s, originalAiText: _o, ...rest } = original;
    const originalAiText = original.originalAiText ?? rest;
    const record = this.audit.createAction({ actionType: ActionType.Amend, targetType: 'story', targetId: id, content: JSON.stringify(patch) });
    this.state.next({
      ...s,
      stories: s.stories.map(st => st.id === id ? { ...st, ...patch, status: ItemStatus.Amended, originalAiText } : st),
      auditLog: [...s.auditLog, record],
    });
  }

  replaceStory(id: string, newStory: UserStory): void {
    const s = this.state.getValue();
    const record = this.audit.createAction({ actionType: ActionType.Regenerate, targetType: 'story', targetId: id, content: null });
    this.state.next({
      ...s,
      stories: s.stories.map(st => st.id === id ? { ...newStory, status: ItemStatus.Draft } : st),
      auditLog: [...s.auditLog, record],
    });
  }

  setTasksForStory(storyId: string, tasks: Task[]): void {
    const s = this.state.getValue();
    this.state.next({ ...s, tasks: { ...s.tasks, [storyId]: tasks } });
  }

  approveTask(storyId: string, taskId: string): void {
    const s = this.state.getValue();
    const record = this.audit.createAction({ actionType: ActionType.Approve, targetType: 'task', targetId: taskId, content: null });
    this.state.next({
      ...s,
      tasks: { ...s.tasks, [storyId]: (s.tasks[storyId] ?? []).map(t => t.id === taskId ? { ...t, status: ItemStatus.Approved } : t) },
      auditLog: [...s.auditLog, record],
    });
  }

  rejectTask(storyId: string, taskId: string, reason?: string): void {
    const s = this.state.getValue();
    const record = this.audit.createAction({ actionType: ActionType.Reject, targetType: 'task', targetId: taskId, content: reason ?? null });
    this.state.next({
      ...s,
      tasks: { ...s.tasks, [storyId]: (s.tasks[storyId] ?? []).map(t => t.id === taskId ? { ...t, status: ItemStatus.Rejected } : t) },
      auditLog: [...s.auditLog, record],
    });
  }

  amendTask(storyId: string, taskId: string, patch: Partial<Task>): void {
    const s = this.state.getValue();
    const original = (s.tasks[storyId] ?? []).find(t => t.id === taskId);
    if (!original) return;
    const { status: _s, originalAiText: _o, ...rest } = original;
    const originalAiText = original.originalAiText ?? rest;
    const record = this.audit.createAction({ actionType: ActionType.Amend, targetType: 'task', targetId: taskId, content: JSON.stringify(patch) });
    this.state.next({
      ...s,
      tasks: { ...s.tasks, [storyId]: (s.tasks[storyId] ?? []).map(t => t.id === taskId ? { ...t, ...patch, status: ItemStatus.Amended, originalAiText } : t) },
      auditLog: [...s.auditLog, record],
    });
  }

  replaceTask(storyId: string, taskId: string, newTask: Task): void {
    const s = this.state.getValue();
    const record = this.audit.createAction({ actionType: ActionType.Regenerate, targetType: 'task', targetId: taskId, content: null });
    this.state.next({
      ...s,
      tasks: { ...s.tasks, [storyId]: (s.tasks[storyId] ?? []).map(t => t.id === taskId ? { ...newTask, status: ItemStatus.Draft } : t) },
      auditLog: [...s.auditLog, record],
    });
  }

  setReviewerName(name: string | null): void {
    const s = this.state.getValue();
    this.state.next({ ...s, reviewerName: name });
  }

  buildExport(): PublishedBacklog {
    const s = this.state.getValue();
    if (!s.stories.some(st => st.status === ItemStatus.Approved || st.status === ItemStatus.Amended)) {
      throw new Error('Cannot publish: no approved stories');
    }
    const approvedStories = s.stories
      .filter(st => st.status === ItemStatus.Approved || st.status === ItemStatus.Amended)
      .map(st => ({
        ...st,
        tasks: (s.tasks[st.id] ?? []).filter(t => t.status === ItemStatus.Approved || t.status === ItemStatus.Amended),
      }));

    return {
      exportVersion: '1.0.0',
      exportId: uuidv4(),
      exportTimestamp: new Date().toISOString(),
      model: MODEL_ID,
      promptVersions: s.promptVersions,
      inputSummary: {
        format: s.inputDocument!.format,
        filename: s.inputDocument!.filename,
        wordCount: s.inputDocument!.wordCount,
        submittedAt: s.inputDocument!.submittedAt,
      },
      existingBacklogItemCount: s.existingBacklogItems.length,
      reviewerName: s.reviewerName,
      keyRequirementsSummary: s.requirementsSummary!,
      userStories: approvedStories,
      auditLog: s.auditLog,
    };
  }

  reset(): void {
    this.state.next({ ...INITIAL_STATE });
  }
}
