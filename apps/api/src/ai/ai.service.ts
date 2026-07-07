import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import { MODEL_ID } from '@smart-backlog/shared';
import { AppLogger } from '../common/logger/app-logger.service';

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:\w+)?\n?([\s\S]*?)\n?```$/s, '$1').trim();
}

@Injectable()
export class AiService {
  constructor(private readonly logger: AppLogger) {}

  complete(prompt: string, signal?: AbortSignal): Promise<string> {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      this.logger.debug(`AI call start — model=${MODEL_ID}`, 'AiService');

      const proc = spawn(
        'claude',
        ['-p', `--model=${MODEL_ID}`, '--output-format=text'],
        { shell: true, stdio: ['pipe', 'pipe', 'pipe'] },
      );

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

      proc.on('close', (code) => {
        const ms = Date.now() - start;
        if (code === 0) {
          this.logger.log(`AI call complete — exit=0 duration=${ms}ms`, 'AiService');
          resolve(stripCodeFences(stdout.trim()));
        } else {
          this.logger.error(`AI call failed — exit=${code} duration=${ms}ms`, undefined, 'AiService');
          reject(new Error(stderr.trim() || `claude exited ${code}`));
        }
      });

      proc.on('error', (err) => {
        this.logger.error(`AI process error: ${err.message}`, undefined, 'AiService');
        reject(err);
      });

      if (signal) {
        signal.addEventListener('abort', () => {
          proc.kill();
          const e = new Error('AbortError');
          e.name = 'AbortError';
          this.logger.warn('AI call aborted by signal', 'AiService');
          reject(e);
        });
      }

      proc.stdin.write(prompt, 'utf8');
      proc.stdin.end();
    });
  }
}
