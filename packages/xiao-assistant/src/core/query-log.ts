import { appendFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

/**
 * Local query log - the feedback loop the knowledge base was missing.
 * Every search/diagnose call records what was asked and which entries it hit;
 * zero-hit rows are the backlog of knowledge worth writing. Records stay on
 * the operator's machine (no telemetry); XIAO_HOME overrides the directory for
 * tests.
 */

function logDir(): string {
  return process.env.XIAO_HOME ?? join(homedir(), '.xiao-assistant');
}

export interface QueryRecord {
  ts: string;
  tool: string;
  query: string;
  board?: string;
  hits: number;
  /** ids of entries that matched (troubleshooting/knowledge) */
  matched: string[];
}

export function recordQuery(rec: Omit<QueryRecord, 'ts'>): void {
  try {
    const dir = logDir();
    mkdirSync(dir, { recursive: true });
    const line: QueryRecord = { ts: new Date().toISOString(), ...rec };
    appendFileSync(join(dir, 'query-log.jsonl'), JSON.stringify(line) + '\n', 'utf-8');
  } catch {
    // Logging must never break the tool.
  }
}

export interface LogStats {
  total: number;
  byTool: Record<string, number>;
  zeroHit: Array<{ query: string; count: number }>;
  topQueries: Array<{ query: string; count: number }>;
  entryHits: Array<{ id: string; count: number }>;
}

export function readStats(): LogStats {
  const file = join(logDir(), 'query-log.jsonl');
  const stats: LogStats = { total: 0, byTool: {}, zeroHit: [], topQueries: [], entryHits: [] };
  if (!existsSync(file)) return stats;

  const zeroHit = new Map<string, number>();
  const top = new Map<string, number>();
  const hits = new Map<string, number>();
  for (const line of readFileSync(file, 'utf-8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line) as QueryRecord;
      stats.total++;
      stats.byTool[rec.tool] = (stats.byTool[rec.tool] ?? 0) + 1;
      const key = `${rec.tool}::${rec.query}`;
      top.set(key, (top.get(key) ?? 0) + 1);
      if (rec.hits === 0) zeroHit.set(key, (zeroHit.get(key) ?? 0) + 1);
      for (const id of rec.matched) hits.set(id, (hits.get(id) ?? 0) + 1);
    } catch {
      // skip malformed lines
    }
  }
  const sortDesc = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).map(([query, count]) => ({ query, count }));
  stats.zeroHit = sortDesc(zeroHit).slice(0, 10);
  stats.topQueries = sortDesc(top).slice(0, 10);
  stats.entryHits = [...hits.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ id, count }))
    .slice(0, 10);
  return stats;
}
