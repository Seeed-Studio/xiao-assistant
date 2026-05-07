import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { XIAOBoard, XIAOExample, XIAODocument, XIAOTroubleshootEntry } from './types.js';

// Works for both ESM and CJS
const _dirname = typeof __dirname !== 'undefined'
  ? __dirname
  : dirname(fileURLToPath(import.meta.url));

let dataDir: string | null = null;

function getDataDir(): string {
  if (dataDir) return dataDir;

  // Resolve relative to the compiled output (dist/data/)
  const distData = resolve(_dirname, '..', 'data');
  if (existsSync(distData)) {
    dataDir = distData;
    return dataDir;
  }

  // Fallback: relative to source (for development / tsx)
  const srcData = resolve(_dirname, '..', '..', 'data');
  if (existsSync(srcData)) {
    dataDir = srcData;
    return dataDir;
  }

  throw new Error(`Cannot find data directory. Looked in: ${distData}, ${srcData}`);
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
      // Recurse into subdirectories (e.g., communication/)
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
    // Skip troubleshooting.yaml — it has a different schema
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
