import { Command } from 'commander';
import express from 'express';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { parse, stringify } from 'yaml';
import pc from 'picocolors';
import open from 'open';

const _dirname = typeof __dirname !== 'undefined'
  ? __dirname
  : dirname(fileURLToPath(import.meta.url));

function getDataDir(): string {
  const distData = resolve(_dirname, '..', '..', 'sdk', 'data');
  if (existsSync(distData)) return distData;
  const srcData = resolve(_dirname, '..', '..', '..', 'sdk', 'data');
  if (existsSync(srcData)) return srcData;
  throw new Error('Cannot find data directory');
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
      const port = parseInt(options.port, 10);
      const app = express();

      app.use(express.json());

      // Serve the editor HTML
      const htmlPath = join(_dirname, '..', 'web', 'knowledge-editor.html');
      app.get('/', (_req, res) => {
        res.sendFile(htmlPath);
      });

      // API: list all knowledge entries
      app.get('/api/knowledge', (_req, res) => {
        res.json(loadAllKnowledge());
      });

      // API: get all board IDs
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

      // API: save a new knowledge entry
      app.post('/api/knowledge', (req, res) => {
        try {
          const entry = req.body;
          if (!entry.title || !entry.problem || !entry.solution) {
            res.status(400).json({ error: 'title, problem, and solution are required' });
            return;
          }

          // Generate ID from title
          if (!entry.id) {
            entry.id = entry.title
              .toLowerCase()
              .replace(/[^a-z0-9一-鿿]+/g, '-')
              .replace(/^-|-$/g, '');
          }

          const dir = getKnowledgeDir();
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

          // Determine file by category
          const fileName = (entry.category || 'general').replace(/\s+/g, '-').toLowerCase() + '.yaml';
          const filePath = join(dir, fileName);

          let existing: any[] = [];
          if (existsSync(filePath)) {
            existing = parse(readFileSync(filePath, 'utf-8')) || [];
          }

          // Check for duplicate ID
          if (existing.some((e: any) => e.id === entry.id)) {
            res.status(409).json({ error: `Entry with id "${entry.id}" already exists in ${fileName}` });
            return;
          }

          existing.push(entry);
          writeFileSync(filePath, stringify(existing, { lineWidth: 0 }) + '\n', 'utf-8');

          res.json({ ok: true, file: fileName, id: entry.id });
        } catch (err: any) {
          res.status(500).json({ error: err.message });
        }
      });

      // API: delete a knowledge entry by ID
      app.delete('/api/knowledge/:id', (req, res) => {
        try {
          const id = req.params.id;
          const dir = getKnowledgeDir();
          let found = false;

          for (const f of readdirSync(dir).filter((n: string) => n.endsWith('.yaml'))) {
            const filePath = join(dir, f);
            const items = parse(readFileSync(filePath, 'utf-8')) || [];
            const filtered = items.filter((e: any) => e.id !== id);
            if (filtered.length < items.length) {
              writeFileSync(filePath, stringify(filtered, { lineWidth: 0 }) + '\n', 'utf-8');
              found = true;
              break;
            }
          }

          res.json({ ok: found });
        } catch (err: any) {
          res.status(500).json({ error: err.message });
        }
      });

      app.listen(port, () => {
        const url = `http://localhost:${port}`;
        console.log(pc.cyan(`\n  XIAO Knowledge Editor`));
        console.log(pc.green(`  ${url}\n`));
        console.log(pc.dim('  Press Ctrl+C to stop\n'));
        open(url).catch(() => {
          console.log(pc.yellow(`  Could not open browser. Visit ${url} manually.`));
        });
      });
    });
}
