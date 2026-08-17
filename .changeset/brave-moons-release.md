---
'@seeed-studio/xiao-assistant': minor
---

Phase 2: the tool grows an execution layer — from "look things up" to "compile, simulate, diagnose".

**MCP (12 tools, +2)**
- `compile_sketch`: real arduino-cli compilation from your AI assistant — firmware size on success, exact compiler errors with `isError` on failure. Agents can now verify code before handing it to users. FQBNs come from verified board data or runtime discovery via `board listall` (no guessed ids).
- `diagnose_ticket`: paste a whole support ticket (zh/en, logs and all) → board/SKU detection, error fingerprints, L1/L2/L3 triage (L3 hardware-risk replies never advise self-fixing) and a ready-to-send Chinese reply.

**CLI (11 commands, +3)**
- `xiao verify <board> [example] [--all] [--dry-run]`: compile served examples into real firmware; `--all` batch-compiles every dependency-free example.
- `xiao ticket [text|-f|stdin]`: same diagnosis as the MCP tool, for support operators.
- `xiao quickstart <board>` + init README now carries the real Board Manager URL, port hint and BOOT gesture per board family (was a 3-line stub).
- `xiao example <id> --sim`: export a Wokwi project — Wokwi ships native XIAO parts (`board-xiao-esp32-c3/c6/s3`, verified against their docs); zero-hardware runs.

**Search & knowledge**
- Board families: Sense variants are supersets — `search --board esp32s3` now finds camera examples (was 0 hits); quickstart is family-aware.
- troubleshoot (CLI+MCP) merges internal-knowledge hits and renders them FIRST; the exact LED_BUILTIN fix was previously buried 77 lines deep.
- Records loop: knowledge entries gain ticketUrl/createdAt/lastVerifiedAt provenance; a local query log (~/.xiao-assistant, no telemetry) feeds `xiao knowledge --stats` — zero-hit backlog = knowledge worth writing.
- Flashing troubleshooting battery 10/10 (Chinese symptoms incl. 上传失败/连不上/烧录成功但没反应/串口权限).

**Quality gates**
- CI firmware job compiles all samd21 examples on every PR (15/15, real toolchain; Seeeduino board index vendored since files.seeedstudio.com 403s worldwide).
- Security hardening from two adversarial audit rounds: --sim path-injection guard, ticket stdin hang fix, compile-timeout reporting, bounded echoes, UTF-8-safe truncation, Chinese compiler errors preserved.
- npm keywords/description rewritten for actual search terms (esp32/mcp-server/pinout...); smithery.yaml prepared.
- 55 tests, 0 known vulnerabilities, publint clean.
