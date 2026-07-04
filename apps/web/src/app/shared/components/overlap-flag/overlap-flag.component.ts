import { Component, Input } from '@angular/core';
import { NgIf } from '@angular/common';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { OverlapFlag } from '@smart-backlog/shared';

@Component({
  standalone: true,
  selector: 'app-overlap-flag',
  imports: [NgIf, MatChipsModule, MatIconModule],
  templateUrl: './overlap-flag.component.html',
  styleUrl: './overlap-flag.component.scss',
})
export class OverlapFlagComponent {
  @Input() flag: OverlapFlag = OverlapFlag.None;
  @Input() reference: string | null = null;

  readonly OverlapFlag = OverlapFlag;

  get isVisible(): boolean {
    return this.flag !== OverlapFlag.None;
  }

  get label(): string {
    return this.flag === OverlapFlag.ExistingOverlap ? 'Existing overlap' : 'Possible duplicate';
  }
}
