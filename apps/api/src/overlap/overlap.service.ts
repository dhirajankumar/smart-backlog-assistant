import { Injectable } from '@nestjs/common';
import {
  ExistingBacklogItem,
  GitHubProjectItem,
  LIMITS,
  OverlapFlag,
  UserStory,
} from '@smart-backlog/shared';

@Injectable()
export class OverlapService {
  private tokenize(text: string): Set<string> {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 1),
    );
  }

  private iou(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) return 0;
    let intersection = 0;
    for (const word of a) {
      if (b.has(word)) intersection++;
    }
    const union = new Set([...a, ...b]).size;
    return union === 0 ? 0 : intersection / union;
  }

  private storyBag(story: UserStory): Set<string> {
    return this.tokenize(`${story.title} ${story.benefit}`);
  }

  private existingBag(item: ExistingBacklogItem): Set<string> {
    return this.tokenize(`${item.title} ${item.description ?? ''}`);
  }

  detectSessionDuplicates(stories: UserStory[]): UserStory[] {
    for (let i = 1; i < stories.length; i++) {
      const bagI = this.storyBag(stories[i]);
      for (let j = 0; j < i; j++) {
        if (this.iou(bagI, this.storyBag(stories[j])) >= LIMITS.OVERLAP_IOU_THRESHOLD) {
          stories[i].overlapFlag = OverlapFlag.SessionDuplicate;
          stories[i].overlapReference = stories[j].title;
          break;
        }
      }
    }
    return stories;
  }

  detectExistingOverlaps(
    stories: UserStory[],
    existing: ExistingBacklogItem[],
  ): UserStory[] {
    for (const story of stories) {
      const bagS = this.storyBag(story);
      for (const item of existing) {
        if (this.iou(bagS, this.existingBag(item)) >= LIMITS.OVERLAP_IOU_THRESHOLD) {
          story.overlapFlag = OverlapFlag.ExistingOverlap;
          story.overlapReference = item.title;
          break;
        }
      }
    }
    return stories;
  }

  detectGithubOverlaps(
    stories: UserStory[],
    githubItems: GitHubProjectItem[],
  ): UserStory[] {
    const existing: ExistingBacklogItem[] = githubItems.map(i => ({
      title: i.title,
      description: i.body ?? undefined,
    }));
    return this.detectExistingOverlaps(stories, existing);
  }
}
