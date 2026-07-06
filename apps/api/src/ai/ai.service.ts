import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import { MODEL_ID } from '@smart-backlog/shared';

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:\w+)?\n?([\s\S]*?)\n?```$/s, '$1').trim();
}

@Injectable()
export class AiService {
  complete(prompt: string, signal?: AbortSignal): Promise<string> {
    return new Promise((resolve, reject) => {
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
        if (code === 0) resolve(stripCodeFences(stdout.trim()));
        else reject(new Error(stderr.trim() || `claude exited ${code}`));
      });

      proc.on('error', reject);

      if (signal) {
        signal.addEventListener('abort', () => {
          proc.kill();
          const e = new Error('AbortError');
          e.name = 'AbortError';
          reject(e);
        });
      }

      proc.stdin.write(prompt, 'utf8');
      proc.stdin.end();
    });
  }
}
