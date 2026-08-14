# Contributing

PRs welcome — especially new board data, examples, and knowledge entries from
real support experience.

## Setup

```bash
pnpm install
pnpm build        # tsup + copies data/ & web/ into dist/
pnpm test         # 37 tests incl. data integrity & example-code gates
pnpm typecheck && pnpm lint:check
```

Node ≥ 20 (CI runs 20; `engines` field enforces it at install time).

## What to contribute

| Change | Read first | Bar |
|---|---|---|
| Board data / examples / knowledge | [docs/DATA.md](./docs/DATA.md) | every field verified against the official wiki; `pnpm test` green |
| CLI or MCP behavior | [docs/CLI.md](./docs/CLI.md), [docs/MCP.md](./docs/MCP.md) | tests for new behavior; malformed input → clean error + exit 1 |
| Core search/indexing | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | keep the invariants listed there (they each guard a shipped bug) |
| The AI-side skill | [skills/xiao-assistant.md](../skills/xiao-assistant.md) | only verified facts — gotchas there were reproduced on hardware data |

**Data PRs specifically:** pin numbers must match the board's wiki pin map
(wrong pins have shipped before and were the worst bug class in this repo's
history), example code must be portable across the Arduino cores it claims
(no `Serial.printf` on SAMD/RP2040/MG24 cores), and boards arrays must respect
each board's `supportedLanguages`.

## Verification checklist for any PR

```bash
pnpm build && pnpm typecheck && pnpm lint:check && pnpm test
```

For packaging changes also run `npm pack --dry-run` and `npx publint` inside
`packages/xiao-assistant` — CI runs both.

## Commit & release

- Conventional commits (`fix:`, `feat(core):`, `docs:` …).
- Releases go through changesets: `pnpm changeset`, pick the bump, and let the
  Version Packages flow produce the CHANGELOG. Publishing runs from GitHub
  Release via `changeset publish` after the full gate.
