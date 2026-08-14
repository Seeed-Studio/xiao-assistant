import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function readYamlDir<T>(sub: string): T[] {
  const results: T[] = [];
  const dir = join(pkgRoot, 'data', sub);
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      for (const sub_ of readdirSync(join(dir, entry.name), { withFileTypes: true })) {
        if (sub_.isFile() && sub_.name.endsWith('.yaml')) {
          results.push(...(parse(readFileSync(join(dir, entry.name, sub_.name), 'utf-8')) as T[]));
        }
      }
    } else if (entry.isFile() && entry.name.endsWith('.yaml')) {
      results.push(...(parse(readFileSync(join(dir, entry.name), 'utf-8')) as T[]));
    }
  }
  return results;
}

const boards = readYamlDir<{ id: string; wikiUrl: string; supportedLanguages: string[] }>('boards');
const examples = readYamlDir<{
  id: string;
  language: string;
  boards: string[];
  code: string;
  wikiUrl?: string;
}>('examples');
const boardIds = new Set(boards.map((b) => b.id));

describe('data integrity: boards', () => {
  it('has at least 12 boards, unique ids, valid wiki URLs', () => {
    expect(boards.length).toBeGreaterThanOrEqual(12);
    expect(new Set(boards.map((b) => b.id)).size).toBe(boards.length);
    for (const b of boards) {
      expect(b.wikiUrl).toMatch(/^https:\/\//);
    }
  });
});

describe('data integrity: cross references', () => {
  it('every example board id exists', () => {
    const bad: string[] = [];
    for (const ex of examples) {
      for (const b of ex.boards) {
        if (!boardIds.has(b)) bad.push(`${ex.id} → ${b}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('every example has non-empty code', () => {
    for (const ex of examples) {
      expect(ex.code.trim().length, ex.id).toBeGreaterThan(20);
    }
  });

  it('every example language is a supported enum', () => {
    const langs = new Set(['arduino', 'micropython', 'circuitpython', 'zephyr']);
    for (const ex of examples) {
      expect(langs.has(ex.language), ex.id).toBe(true);
    }
  });
});

describe('data integrity: ids are unique across same-type files', () => {
  it('example ids do not collide', () => {
    const ids = examples.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
