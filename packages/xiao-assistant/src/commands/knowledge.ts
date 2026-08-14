import { Command } from 'commander';
import express from 'express';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { parse, stringify } from 'yaml';
import pc from 'picocolors';
import open from 'open';

const _dirname = dirname(fileURLToPath(import.meta.url));

function getDataDir(): string {
  // tsup bundles into dist/index.js, data is at dist/data/
  // src runs execute here as src/commands/, data is at ../../data
  const candidates = [resolve(_dirname, 'data'), resolve(_dirname, '..', '..', 'data')];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`Cannot find data directory. Looked in: ${candidates.join(', ')}`);
}

function getWebDir(): string {
  const candidates = [resolve(_dirname, 'web'), resolve(_dirname, '..', '..', 'web')];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`Cannot find web directory. Looked in: ${candidates.join(', ')}`);
}

/** Whitelist filename characters so category can never traverse out of the knowledge dir */
function sanitizeCategory(category: string): string {
  const cleaned = category
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'general';
}

const SEVERITIES = new Set(['easy', 'medium', 'hard']);
const SOURCES = new Set(['support-ticket', 'internal-test', 'community', 'wiki']);

/**
 * Coerce and validate a submitted entry against the XIAOKnowledge contract.
 * Bad data written here would crash every searchKnowledge() call, so be strict.
 */
function validateEntry(
  raw: unknown
): { ok: true; entry: Record<string, unknown> } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null)
    return { ok: false, error: 'entry must be an object' };
  const e = raw as Record<string, unknown>;

  for (const key of ['title', 'problem', 'solution', 'summary'] as const) {
    if (typeof e[key] !== 'string' || (e[key] as string).length === 0) {
      return { ok: false, error: `${key} is required and must be a non-empty string` };
    }
  }

  const category = typeof e.category === 'string' && e.category ? e.category : 'general';
  const severity =
    typeof e.severity === 'string' && SEVERITIES.has(e.severity) ? e.severity : 'medium';
  const source =
    typeof e.source === 'string' && SOURCES.has(e.source) ? e.source : 'support-ticket';

  const toStringArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

  const boards = toStringArray(e.boards);
  const tags = toStringArray(e.tags);

  const entry: Record<string, unknown> = {
    id:
      typeof e.id === 'string' && e.id
        ? e.id
        : (e.title as string)
            .toLowerCase()
            .replace(/[^a-z0-9一-鿿]+/g, '-')
            .replace(/^-|-$/g, ''),
    title: e.title,
    tags,
    boards,
    category,
    severity,
    source,
    summary: e.summary,
    problem: e.problem,
    solution: e.solution,
  };
  if (typeof e.code === 'string' && e.code) entry.code = e.code;
  if (typeof e.workaround === 'string' && e.workaround) entry.workaround = e.workaround;

  return { ok: true, entry };
}

function getKnowledgeDir(): string {
  return join(getDataDir(), 'knowledge');
}

function loadAllKnowledge(): any[] {
  const dir = getKnowledgeDir();
  if (!existsSync(dir)) return [];
  const results: any[] = [];
  for (const f of readdirSync(dir).filter((n: string) => n.endsWith('.yaml'))) {
    const items = parse(readFileSync(join(dir, f), 'utf-8'));
    if (Array.isArray(items)) results.push(...items);
  }
  return results;
}

export function registerKnowledgeCommand(program: Command) {
  program
    .command('knowledge')
    .description('Launch the knowledge editor web UI')
    .option('-p, --port <port>', 'Port number', '3456')
    .action(async (options: { port: string }) => {
      // Strict digits-only: parseInt('80a') === 80 would silently pass and
      // try to bind a privileged port.
      if (!/^\d+$/.test(options.port.trim())) {
        console.error(pc.red(`Invalid port "${options.port}" (expected 1-65535).`));
        process.exitCode = 1;
        return;
      }
      const port = Number.parseInt(options.port, 10);
      if (port < 1 || port > 65535) {
        console.error(pc.red(`Invalid port "${options.port}" (expected 1-65535).`));
        process.exitCode = 1;
        return;
      }
      const app = express();

      app.disable('x-powered-by');
      app.use(express.json({ limit: '512kb' }));

      // Local tool: reject cross-origin requests. Blocks drive-by fetches from
      // web pages and DNS-rebinding attacks (Host resolved to 127.0.0.1).
      const port_ = port;
      app.use((req, res, next) => {
        const origin = req.headers.origin;
        if (origin) {
          try {
            const { host } = new URL(origin);
            if (host !== `localhost:${port_}` && host !== `127.0.0.1:${port_}`) {
              res.status(403).json({ error: 'Cross-origin requests are not allowed' });
              return;
            }
          } catch {
            res.status(403).json({ error: 'Invalid Origin header' });
            return;
          }
        }
        const host = req.headers.host ?? '';
        if (host !== `localhost:${port_}` && host !== `127.0.0.1:${port_}`) {
          res.status(403).json({ error: 'Invalid Host header' });
          return;
        }
        next();
      });

      const htmlPath = join(getWebDir(), 'knowledge-editor.html');
      app.get('/', (_req, res) => {
        res.sendFile(htmlPath);
      });

      app.get('/api/knowledge', (_req, res) => {
        res.json(loadAllKnowledge());
      });

      app.get('/api/boards', (_req, res) => {
        const boardsDir = join(getDataDir(), 'boards');
        const boards: string[] = [];
        for (const f of readdirSync(boardsDir).filter((n: string) => n.endsWith('.yaml'))) {
          const items = parse(readFileSync(join(boardsDir, f), 'utf-8'));
          if (Array.isArray(items)) {
            items.forEach((b: any) => boards.push(b.id));
          }
        }
        res.json(boards);
      });

      app.post('/api/knowledge', (req, res) => {
        try {
          const validated = validateEntry(req.body);
          if (!validated.ok) {
            res.status(400).json({ error: validated.error });
            return;
          }
          const entry = validated.entry as {
            id: string;
            title: string;
            category: string;
          };

          const dir = getKnowledgeDir();
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

          const fileName = `${sanitizeCategory(entry.category)}.yaml`;
          const filePath = join(dir, fileName);
          if (resolve(dirname(filePath)) !== resolve(dir)) {
            res.status(400).json({ error: 'Invalid category' });
            return;
          }

          let existing: any[] = [];
          if (existsSync(filePath)) {
            existing = parse(readFileSync(filePath, 'utf-8')) || [];
          }

          // Duplicate-id protection must scan the WHOLE knowledge dir: ids are
          // globally unique per the XIAOKnowledge contract, and a cross-file
          // duplicate would crash every entry point on next startup.
          const idsTaken = new Set<string>();
          for (const f of readdirSync(dir).filter((n: string) => n.endsWith('.yaml'))) {
            for (const e of (parse(readFileSync(join(dir, f), 'utf-8')) as any[]) || []) {
              if (e?.id) idsTaken.add(e.id);
            }
          }
          if (idsTaken.has(entry.id)) {
            res.status(409).json({
              error: `Entry with id "${entry.id}" already exists (checked all knowledge files)`,
            });
            return;
          }

          existing.push(entry);
          writeFileSync(filePath, stringify(existing, { lineWidth: 0 }) + '\n', 'utf-8');

          res.json({ ok: true, file: fileName, id: entry.id });
        } catch (err: any) {
          res.status(500).json({ error: err.message });
        }
      });

      app.delete('/api/knowledge/:id', (req, res) => {
        try {
          const id = req.params.id;
          const dir = getKnowledgeDir();
          let found = false;

          for (const f of readdirSync(dir).filter((n: string) => n.endsWith('.yaml'))) {
            const filePath = join(dir, f);
            const items = parse(readFileSync(filePath, 'utf-8')) || [];
            const removed = items.filter((e: any) => e.id === id);
            if (removed.length > 0) {
              // Recycle instead of hard delete: the knowledge base is hand-curated
              // support experience; an accidental DELETE must be recoverable.
              const trashDir = join(dir, '.trash');
              if (!existsSync(trashDir)) mkdirSync(trashDir, { recursive: true });
              const stamp = new Date().toISOString().replace(/[:.]/g, '-');
              const trashPath = join(trashDir, `${stamp}__${f}`);
              const existingTrash = existsSync(trashPath)
                ? (parse(readFileSync(trashPath, 'utf-8')) as any[]) || []
                : [];
              writeFileSync(
                trashPath,
                stringify([...existingTrash, ...removed], { lineWidth: 0 }) + '\n',
                'utf-8'
              );

              writeFileSync(
                filePath,
                stringify(
                  items.filter((e: any) => e.id !== id),
                  { lineWidth: 0 }
                ) + '\n',
                'utf-8'
              );
              found = true;
              break;
            }
          }

          res.json({ ok: found, note: 'entries moved to data/knowledge/.trash/' });
        } catch (err: any) {
          res.status(500).json({ error: err.message });
        }
      });

      // Localhost only: this editor has no auth and writes to the repo's YAML files,
      // so it must never be reachable from the network.
      const server = app.listen(port, '127.0.0.1', () => {
        const url = `http://localhost:${port}`;
        console.log(pc.cyan(`\n  XIAO Knowledge Editor`));
        console.log(pc.green(`  ${url}\n`));
        console.log(pc.dim('  Press Ctrl+C to stop\n'));
        open(url).catch(() => {
          console.log(pc.yellow(`  Could not open browser. Visit ${url} manually.`));
        });
      });
      // A banner followed by silent exit 0 (EADDRINUSE etc.) reads as success.
      server.on('error', (err: NodeJS.ErrnoException) => {
        const reason = err.code === 'EADDRINUSE' ? 'port already in use' : err.message;
        console.error(pc.red(`\n  Failed to listen on port ${port}: ${reason}`));
        process.exitCode = 1;
      });
    });
}
