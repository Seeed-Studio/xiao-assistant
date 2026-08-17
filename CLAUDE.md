# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install                  # install all workspace deps
pnpm build                    # build all packages (tsup + copy data/web into dist)
pnpm typecheck                # tsc --noEmit for all packages
pnpm test                     # vitest run (tests live in packages/xiao-assistant/test/)
pnpm lint                     # eslint src --fix (run per-package)
pnpm lint:check               # eslint src (CI-style check)
pnpm format                   # prettier --write src

# Run the CLI locally after build
node packages/xiao-assistant/dist/index.js <command>
# e.g. node packages/xiao-assistant/dist/index.js pinout esp32c3

# Watch mode build
cd packages/xiao-assistant && pnpm dev
```

CI (`.github/workflows/ci.yml`) runs on PRs to `main`: `pnpm build && pnpm typecheck && pnpm lint:check && pnpm test && pnpm pack --dry-run`.

## Architecture

Single-package pnpm monorepo (`packages/*`). Everything lives in `packages/xiao-assistant` — one npm package (`@seeed-studio/xiao-assistant`) that ships a CLI (`xiao`), an MCP server, and the core SDK, bundled by tsup into `dist/index.js` (CLI/bin) and `dist/sdk.js` (side-effect-free SDK entry; this is what `exports["."]` resolves to — importing the CLI entry runs `program.parse()`).

Three layers inside `packages/xiao-assistant/src/`:

- **`core/`** — the SDK. `XIAOAssistant` (assistant.ts) builds MiniSearch indexes at construction; duplicate entry ids are deduped (keep-first) so bad data cannot brick startup; board map keys are normalized — separators stripped — so `getBoard('esp32s3-sense')` and `'esp32s3sense'` both hit); provides board resolution, scored keyword search over examples/docs/knowledge/troubleshooting (blank queries return `[]` by design), ASCII pinout rendering, and wiki fallback. `wiki-service.ts` fetches the wiki **sitemap** (wiki.seeedstudio.com migrated to Docusaurus; the old MediaWiki `api.php` is gone) and scores URL slugs — 24h in-memory index cache, 5min result cache, returns `[]` on any failure. Queries are expanded with synonyms from `data/synonyms.yaml`. `__setWikiIndexForTest` lets tests inject a fixture index.
- **`commands/`** — Commander-based CLI subcommands (init, pinout, boards, search, example, troubleshoot, quickstart, verify, ticket, knowledge), registered in `src/index.ts` behind a main-module guard. The `knowledge` command is different: it starts an Express server **bound to 127.0.0.1 with Host/Origin validation** that serves `web/knowledge-editor.html` and exposes a REST API that reads/writes the YAML files in `data/knowledge/` (entries pass `validateEntry`, categories are whitelisted to `[a-z0-9-]`).
- **`mcp/`** — MCP stdio server (`xiao mcp`) exposing 12 tools (compile_sketch → core/compiler.ts; diagnose_ticket → core/ticket.ts fingerprint triage) over the same `XIAOAssistant` instance; server version comes from package.json. Tool arguments are validated via a typed accessor (malformed args → `InvalidParams`). `search_examples` returns full code for the top 3 hits only; the rest are listed by id for `get_example`.

### Data files

All content is static YAML under `packages/xiao-assistant/data/`: `boards/`, `examples/` (with subdirectories like `communication/`), `docs/` (getting-started guides + `troubleshooting.yaml`), `knowledge/`, plus `synonyms.yaml`. Each file contains an array of entries typed in `src/core/types.ts` (`XIAOBoard`, `XIAOExample`, `XIAODocument`, `XIAOTroubleshootEntry`, `XIAOKnowledge`).

**Critical build detail:** the `build` script copies `data/` and `web/` into `dist/` because `data-loader.ts` resolves the data directory relative to `import.meta.url` (checks `dist/data` first, then falls back to `../data` for source-tree runs). If data loading breaks, check this path resolution and the copy step.

Search runs on MiniSearch (fuzzy 0.2 + prefix + field boosts; synonym expansion incl. Chinese aliases feeds a multi-query) — matches on exact field, tag, expanded synonym, and per-word levels with different weights, sorted by score. Adding new searchable content means adding YAML entries; no re-index step is needed.

## Release

Changesets (`pnpm changeset`). Version bumps and CHANGELOG come from changeset files; `pnpm release` = `pnpm build && changeset publish`. Publishing runs in `.github/workflows/release.yml` on GitHub Release, using `NPM_TOKEN` via `NODE_AUTH_TOKEN`.

## Conventions

- ESM everywhere (`"type": "module"`); relative imports use `.js` extensions.
- TypeScript is maximally strict — including `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`. Don't casually add optional properties or index arrays without handling `undefined`.
- Prettier enforces single quotes, semicolons, 100-char print width; eslint runs prettier as a rule (`pnpm lint:check` fails on unformatted code).
- Root `demo.js` is stale (imports `packages/sdk/dist`, which no longer exists after the merge into a single package) — don't use it as a reference.
