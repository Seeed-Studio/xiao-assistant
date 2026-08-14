import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** All example entries with their source file, recursing subdirectories. */
function loadExamples(): Array<{ id: string; language: string; code: string; boards: string[] }> {
  const root = join(pkgRoot, 'data', 'examples');
  const out: Array<{ id: string; language: string; code: string; boards: string[] }> = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        // Recycle bins and other dot-dirs are never data.
        if (!e.name.startsWith('.')) walk(join(dir, e.name));
      } else if (e.name.endsWith('.yaml')) {
        for (const ex of parse(readFileSync(join(dir, e.name), 'utf-8')) ?? []) out.push(ex);
      }
    }
  };
  walk(root);
  return out;
}

/**
 * Statement scanner: finds every Serial.print/println(...) call and the index
 * just past its matching close paren. String/char literal and paren-depth aware.
 */
function serialStatementEnds(code: string): number[] {
  const ends: number[] = [];
  let i = 0;
  while (i < code.length) {
    const m = code.indexOf('Serial.print', i);
    if (m < 0) break;
    const prev = code[m - 1] ?? '\n';
    if (!' \t\n;}{'.includes(prev)) {
      i = m + 12;
      continue;
    }
    let j = m + 'Serial.print'.length;
    if (code.startsWith('ln(', j)) j += 3;
    else if (code[j] === '(') j += 1;
    else {
      i = m + 12;
      continue;
    }
    let depth = 1;
    let q: string | null = null;
    const start = j;
    while (j < code.length && depth > 0) {
      const c = code[j];
      if (q) {
        if (c === '\\') {
          j += 2;
          continue;
        }
        if (c === q) q = null;
      } else if (c === '"' || c === "'") q = c;
      else if (c === '(') depth += 1;
      else if (c === ')') depth -= 1;
      j += 1;
    }
    if (depth === 0) ends.push(j); // j = index just past ')'
    i = j > start ? j : start;
  }
  return ends;
}

describe('example code static gate (regression: 107 missing semicolons once shipped)', () => {
  const examples = loadExamples();

  it('loads all examples', () => {
    expect(examples.length).toBeGreaterThanOrEqual(60);
  });

  it('no example code contains Serial.printf (not portable across Arduino cores)', () => {
    for (const ex of examples) {
      expect(ex.code.includes('Serial.printf'), ex.id).toBe(false);
    }
  });

  it('every Serial.print/println statement ends with a semicolon', () => {
    const offenders: string[] = [];
    for (const ex of examples) {
      for (const end of serialStatementEnds(ex.code)) {
        let k = end;
        while (k < ex.code.length && ' \t\r\n'.includes(ex.code[k] ?? ' ')) k += 1;
        if (k < ex.code.length && ex.code[k] !== ';') offenders.push(`${ex.id}@${end}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('code blocks are paren/brace balanced and quotes even (non-comment lines)', () => {
    for (const ex of examples) {
      const c = ex.code;
      expect(c.split('(').length, `${ex.id} parens`).toBe(c.split(')').length);
      expect(c.split('{').length, `${ex.id} braces`).toBe(c.split('}').length);
      const noComments = c
        .split('\n')
        .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
        .join('\n');
      expect(noComments.split('"').length % 2, `${ex.id} quotes`).toBe(1);
    }
  });
});
