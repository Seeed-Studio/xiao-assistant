# XIAO Assistant

[![NPM Version](https://img.shields.io/npm/v/%40seeed-studio%2Fxiao-assistant?color=blue)](https://www.npmjs.com/package/@seeed-studio/xiao-assistant) [![MIT licensed](https://img.shields.io/npm/l/%40seeed-studio%2Fxiao-assistant)](./LICENSE)

AI-powered development tools for Seeed Studio XIAO boards — a CLI (`xiao`), an MCP server for AI coding tools, and an importable SDK, all serving one verified knowledge core.

- **17 XIAO Boards** — official comparison table fully covered (incl. ESP32-C5 and nRF54LM20A), pin maps verified field-by-field against the wiki, deep-sleep power data included
- **64 Code Examples** — Arduino / MicroPython / CircuitPython / Zephyr, statically gated so every sketch compiles clean (portable across cores)
- **Search that behaves like a user** — fuzzy (`temprature` works), Chinese (蓝牙 / 低功耗 / 上传失败), synonym-expanded
- **Troubleshooting** — real symptom vocabulary ("Connecting...", "no serial port", 中文症状), board-accurate advice (native USB needs no CP210x)
- **Knowledge Base** — field-tested fixes from customer support, editable in a local-first web UI with soft delete
- **Wiki Fallback** — live wiki.seeedstudio.com search when local data runs out

## Quick start

```bash
npm i -g @seeed-studio/xiao-assistant

xiao init -b esp32c3 -l arduino -y    # scaffold a project (knows esp32c3 has no onboard LED)
xiao pinout esp32c5                    # pins, specs, deep-sleep current
xiao search "deep sleep" --board esp32s3
xiao troubleshoot "upload fails Connecting..."
xiao search 蓝牙                        # Chinese works
```

## Use it from your AI tool

```bash
claude mcp add xiao-assistant -- npx -y @seeed-studio/xiao-assistant mcp
```

10 read-only tools: `resolve_board` (natural-language + Chinese + typo
tolerant, power-aware), `get_board_info`, `get_pinout`, `search_examples`,
`get_example`, `list_boards`, `get_quickstart`, `troubleshoot`,
`search_knowledge`, `search_wiki`. See **[docs/MCP.md](./docs/MCP.md)** for
every tool, config snippets for Claude Code / Claude Desktop / Cursor, and a
sample session.

## Use it as a library

```js
import { XIAOAssistant } from '@seeed-studio/xiao-assistant';

const xiao = new XIAOAssistant();          // loads + indexes everything, no side effects
xiao.getPinout('esp32s3-sense');
xiao.searchExamples('温度传感器');
await xiao.searchWikiOnline('xiao esp32c5');
```

## Supported boards

ESP32C3 · ESP32C5 (Wi-Fi 6 dual-band) · ESP32C6 · ESP32S3 / S3 Sense · RP2040 ·
RP2350 · nRF52840 / Sense · SAMD21 · RA4M1 · MG24 / Sense · nRF54L15 / Sense ·
nRF54LM20A / Sense — the official comparison table in full, SKUs cross-checked.

## Documentation

| Doc | For |
|---|---|
| [docs/CLI.md](./docs/CLI.md) | every command, flag, exit code |
| [docs/MCP.md](./docs/MCP.md) | tool reference + AI-tool configuration |
| [docs/DATA.md](./docs/DATA.md) | adding boards / examples / knowledge (schemas, wiki-verification bar) |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | how the layers fit, invariants, verification posture |
| [skills/xiao-assistant.md](./skills/xiao-assistant.md) | usage rules your AI assistant should follow |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | dev setup, PR bar, release flow |

## Development

```bash
pnpm install && pnpm build && pnpm test
```

MIT © [Seeed Studio](https://www.seeedstudio.com)
