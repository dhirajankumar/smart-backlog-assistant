import { InputFormat } from '../enums/input-format.enum';

export interface InputDocument {
  id: string;
  format: InputFormat;
  rawContent: string;
  filename: string | null;
  wordCount: number;
  segmentCount: number;
  submittedAt: string;
}
