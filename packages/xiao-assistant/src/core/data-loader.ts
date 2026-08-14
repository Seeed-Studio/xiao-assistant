import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type {
  XIAOBoard,
  XIAOExample,
  XIAODocument,
  XIAOTroubleshootEntry,
  XIAOKnowledge,
} from './types.js';

const _dirname = dirname(fileURLToPath(import.meta.url));

let dataDir: string | null = null;

function getDataDir(): string {
  if (dataDir) return dataDir;

  // tsup bundles into dist/index.js, data is at dist/data/
  // src runs (vitest/tsx) execute here as src/core/, data is at ../../data
  const candidates = [resolve(_dirname, 'data'), resolve(_dirname, '..', '..', 'data')];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      dataDir = candidate;
      return dataDir;
    }
  }

  throw new Error(`Cannot find data directory. Looked in: ${candidates.join(', ')}`);
}

function readYamlFile<T>(filePath: string): T {
  const content = readFileSync(filePath, 'utf-8');
  return parse(content) as T;
}

function readYamlDir<T>(dirPath: string): T[] {
  const results: T[] = [];
  if (!existsSync(dirPath)) return results;

  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const subDir = join(dirPath, entry.name);
      for (const subEntry of readdirSync(subDir, { withFileTypes: true })) {
        if (subEntry.isFile() && subEntry.name.endsWith('.yaml')) {
          const items = readYamlFile<T[]>(join(subDir, subEntry.name));
          results.push(...items);
        }
      }
    } else if (entry.isFile() && entry.name.endsWith('.yaml')) {
      const items = readYamlFile<T[]>(join(dirPath, entry.name));
      results.push(...items);
    }
  }
  return results;
}

export function loadBoards(): XIAOBoard[] {
  return readYamlDir<XIAOBoard>(join(getDataDir(), 'boards'));
}

export function loadExamples(): XIAOExample[] {
  return readYamlDir<XIAOExample>(join(getDataDir(), 'examples'));
}

export function loadDocuments(): XIAODocument[] {
  const docsDir = join(getDataDir(), 'docs');
  const results: XIAODocument[] = [];
  if (!existsSync(docsDir)) return results;

  for (const entry of readdirSync(docsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.yaml')) continue;
    if (entry.name === 'troubleshooting.yaml') continue;
    const items = readYamlFile<XIAODocument[]>(join(docsDir, entry.name));
    results.push(...items);
  }
  return results;
}

export function loadTroubleshootEntries(): XIAOTroubleshootEntry[] {
  const filePath = join(getDataDir(), 'docs', 'troubleshooting.yaml');
  if (!existsSync(filePath)) return [];
  return readYamlFile<XIAOTroubleshootEntry[]>(filePath);
}

export function loadSynonyms(): Record<string, string[]> {
  const filePath = join(getDataDir(), 'synonyms.yaml');
  if (!existsSync(filePath)) return {};
  return readYamlFile<Record<string, string[]>>(filePath);
}

export function loadKnowledge(): XIAOKnowledge[] {
  return readYamlDir<XIAOKnowledge>(join(getDataDir(), 'knowledge'));
}
