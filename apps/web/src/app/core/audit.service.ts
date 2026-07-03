import { Injectable } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';
import { ReviewAction } from '@smart-backlog/shared';

@Injectable({ providedIn: 'root' })
export class AuditService {
  createAction(action: Omit<ReviewAction, 'id' | 'timestamp'>): ReviewAction {
    return { ...action, id: uuidv4(), timestamp: new Date().toISOString() };
  }
}
