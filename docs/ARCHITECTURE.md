# Architecture

One npm package, three delivery surfaces, one knowledge core.

```
                    ┌───────────────────────────────────────────┐
                    │              data/ (YAML)                 │
                    │  boards · examples · docs · knowledge ·   │
                    │  synonyms                                 │
                    └───────────────────┬───────────────────────┘
                                        │ load once per process
                    ┌───────────────────┴───────────────────────┐
                    │            core/ (SDK)                    │
                    │  XIAOAssistant                            │
                    │   · board map (normalized ids)            │
                    │   · MiniSearch indexes ×4 (fuzzy/prefix)  │
                    │   · synonym expansion (EN + 中文)          │
                    │   · pinout rendering                      │
                    │  wiki-service (sitemap crawl, cached)     │
                    └──────┬──────────────────┬─────────────────┘
                           │                  │
              ┌────────────┴─────┐   ┌────────┴──────────┐
              │  commands/ (CLI) │   │   mcp/ (stdio)    │
              │  xiao <command>  │   │  10 read-only     │
              │  + knowledge     │   │  tools            │
              │    web editor    │   │                   │
              └──────────────────┘   └───────────────────┘
                     dist/index.js (bin)   dist/index.js (mcp mode)

  separate entry: dist/sdk.js — side-effect-free import for library consumers
```

## Entries and packaging

tsup builds two entries:

- `dist/index.js` — the `xiao` bin. Parsed behind a main-module guard that
  compares `import.meta.url` against argv[1] **and its realpath** (npm bin
  entries are symlinks; a plain string compare made `npm i -g` a silent no-op
  once). Importing it is safe; it only runs `program.parse()` when executed.
- `dist/sdk.js` — what `exports["."]` resolves to. `import { XIAOAssistant }
  from '@seeed-studio/xiao-assistant'` loads data, builds indexes, and never
  touches argv.

The build copies `data/` and `web/` into `dist/`; `data-loader` resolves the
data directory relative to `import.meta.url` (`dist/data` first, `../../data`
for source-tree runs). If data loading breaks, check that copy step first.

## Invariants worth knowing before changing things

- **Board map keys are normalized** (lowercase, separators stripped) so
  `esp32s3-sense`, `ESP32S3_SENSE` and `esp32s3sense` all hit. Lookups go
  through the same normalization.
- **Duplicate entity ids are deduped keep-first at load** — MiniSearch throws
  on duplicates and one bad edit must never brick every entry point. The
  knowledge editor enforces global id uniqueness at write time instead.
- **Dot-directories are skipped by the loader** (`knowledge/.trash/` is the
  recycle bin and must never be indexed).
- **Blank queries return `[]`** from every search method — `includes('')` is
  true for everything, so an unguarded blank query dumps the whole catalog.
- **Search is MiniSearch** (fuzzy 0.2, prefix, field boosts). Synonym expansion
  (including Chinese aliases and CJK-substring matching) feeds a multi-query
  so expanded terms merge into one ranking. `resolveBoard` is separate
  hand-rolled scoring that also indexes `lowPowerMode` — natural-language
  selection depends on it.
- **The wiki search crawls the sitemap**, because wiki.seeedstudio.com left
  MediaWiki (the old `api.php` is 404). Index cached 24 h in-memory, results
  5 min, any failure returns `[]` — callers never see network errors.

## Knowledge editor (commands/knowledge.ts)

An Express app bound to **127.0.0.1** with Host/Origin validation (DNS-rebinding
defense), category whitelisted to `[a-z0-9-]` with a resolved-path containment
check, full-entry validation before write, global-id dedup, 512 KB body cap,
and timestamped soft-delete into `.trash/`. It edits the same YAML the CLI/SDK/
MCP read — keep that write path strict; it is the only unauthenticated writer
in the system (localhost-only by design).

## Verification posture

- `pnpm test` — 37 tests including data gates: schema/cross-refs, pin
  regressions locking the corrected serial pins, blink/esp32c3 compatibility,
  and a **static code gate** over every example (no `Serial.printf`, every
  `Serial.print*` statement semicolon-terminated, balanced parens/braces).
- `pnpm sync:wiki` — diffs the wiki sitemap against `data/boards/`; a weekly
  Actions job opens an issue when a new XIAO series appears.
- CI: build → typecheck → lint → test → `npm pack --dry-run` → publint.
