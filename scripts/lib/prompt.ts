/** Terminal prompts for the setup scripts. */
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';

export async function ask(question: string, fallback = ''): Promise<string> {
  const hint = fallback ? ` [${fallback}]` : '';
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await rl.question(`${question}${hint}: `)).trim();
    return answer || fallback;
  } finally {
    rl.close();
  }
}

/**
 * Reads a line without showing it (for secrets), handling
 * Backspace, Enter, Ctrl+C and pasted text. Falls back to a plain read when
 * input isn't a terminal (e.g. piped), where hiding isn't possible.
 */
export async function askHidden(question: string): Promise<string> {
  if (!stdin.isTTY) return ask(question);
  stdout.write(`${question}: `);
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolvePromise) => {
    let value = '';
    const finish = () => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
      resolvePromise(value.trim());
    };
    const onData = (chunk: Buffer) => {
      for (const ch of chunk.toString('utf8')) {
        if (ch === '\r' || ch === '\n') return finish();
        if (ch === '\u0003') {
          stdin.setRawMode(false);
          stdout.write('\n');
          process.exit(130);
        }
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else if (ch >= ' ') value += ch;
      }
    };
    stdin.on('data', onData);
  });
}
