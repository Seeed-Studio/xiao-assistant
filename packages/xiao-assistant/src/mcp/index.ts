import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileSketch } from '../core/compiler.js';
import { analyzeTicket } from '../core/ticket.js';
import { recordQuery } from '../core/query-log.js';
import {
  XIAOAssistant,
  type XIAOBoard,
  type XIAOExample,
  type XIAOTroubleshootEntry,
  type WikiSearchResult,
  type XIAOKnowledge,
} from '../core/assistant.js';

const _dirname = dirname(fileURLToPath(import.meta.url));
// bundled: dist/index.js -> <pkg>/package.json; src run: src/mcp/ -> <pkg>/package.json
const pkgCandidates = [
  join(_dirname, '..', 'package.json'),
  join(_dirname, '..', '..', '..', 'package.json'),
];
const pkgPath = pkgCandidates.find((p) => existsSync(p));
if (!pkgPath) throw new Error(`package.json not found. Looked in: ${pkgCandidates.join(', ')}`);
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string };

export async function startMcpServer() {
  const assistant = new XIAOAssistant();

  const server = new Server(
    {
      name: 'xiao-assistant',
      version: pkg.version,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'resolve_board',
        title: 'Resolve XIAO Board',
        description: `Resolves a user query to a specific XIAO board. Call this FIRST when the user mentions a XIAO board to get the exact board ID for use with other tools.

Each result includes:
- Board ID: Use this ID with other tools (get_board_info, get_pinout)
- Full specifications, connectivity, sensors, and supported languages

For ambiguous queries (e.g. "xiao with wifi"), multiple boards may be returned.

IMPORTANT: Always call this before get_board_info unless the user provides an exact board ID.`,
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description:
                'Description of the board the user is looking for (e.g. "xiao esp32c3", "xiao with camera", "bluetooth xiao")',
            },
          },
          required: ['query'],
        },
        annotations: { readOnlyHint: true },
      },
      {
        name: 'get_board_info',
        title: 'Get XIAO Board Info',
        description: `Get detailed specifications and pin information for a specific XIAO board. Returns complete board data including:
- Microcontroller, architecture, clock speed
- Flash and RAM sizes
- Complete pin mapping (digital, analog, PWM, I2C, SPI, UART)
- Connectivity (WiFi, Bluetooth, Zigbee, Thread)
- Built-in sensors
- Supported programming languages
- Wiki documentation URL`,
        inputSchema: {
          type: 'object',
          properties: {
            board: {
              type: 'string',
              description:
                'Board ID (e.g. esp32c3, esp32s3, rp2040, nrf52840, samd21). Use resolve_board first if unsure.',
            },
          },
          required: ['board'],
        },
        annotations: { readOnlyHint: true },
      },
      {
        name: 'get_pinout',
        title: 'Get XIAO Pinout',
        description: `Get a formatted pinout diagram for a XIAO board showing all pin functions including GPIO, ADC, PWM, I2C, SPI, and UART assignments.`,
        inputSchema: {
          type: 'object',
          properties: {
            board: {
              type: 'string',
              description: 'Board ID (e.g. esp32c3, esp32s3, rp2040)',
            },
          },
          required: ['board'],
        },
        annotations: { readOnlyHint: true },
      },
      {
        name: 'search_examples',
        title: 'Search XIAO Code Examples',
        description: `Search for code examples for XIAO development. Returns matching examples with full source code, compatible boards, and required libraries.

Examples cover: LED blink, WiFi, Bluetooth, I2C, SPI, sensors, deep sleep, MQTT, camera, PWM, displays, motors, audio, storage, and more.

Each result includes the complete source code ready to use.`,
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description:
                'Search query (e.g. "wifi", "bluetooth", "temperature sensor", "oled display", "mqtt")',
            },
            language: {
              type: 'string',
              enum: ['arduino', 'micropython', 'circuitpython', 'zephyr'],
              description: 'Filter by programming language',
            },
            board: {
              type: 'string',
              description: 'Filter by board ID',
            },
          },
          required: ['query'],
        },
        annotations: { readOnlyHint: true },
      },
      {
        name: 'get_example',
        title: 'Get Code Example by ID',
        description: `Fetch a single code example with its complete source code by example ID. Use this after search_examples listed a match in its "More matches" section without full code.`,
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description:
                'Example ID (e.g. blink-arduino, wifi-connect-arduino, i2c-scan-arduino-nrf54l15)',
            },
          },
          required: ['id'],
        },
        annotations: { readOnlyHint: true },
      },
      {
        name: 'compile_sketch',
        title: 'Compile a Sketch for a Board',
        description: `Compile Arduino sketch code for a XIAO board with arduino-cli and report the real compiler result (firmware size, or exact error lines). Use this to verify code you write BEFORE handing it to the user - a sketch that fails here will fail in their IDE too. Requires arduino-cli installed locally; the first compile for a board downloads toolchains and can take minutes. Source: pass \`code\` directly, or \`exampleId\` to compile a bundled example.`,
        inputSchema: {
          type: 'object',
          properties: {
            board: {
              type: 'string',
              description: 'Board ID (resolve_board first if unsure)',
            },
            code: {
              type: 'string',
              description: 'Complete .ino source (max 64KB). Mutually exclusive with exampleId.',
            },
            exampleId: {
              type: 'string',
              description: 'Compile a bundled example by id instead of inline code.',
            },
          },
          required: ['board'],
        },
      },
      {
        name: 'diagnose_ticket',
        title: 'Diagnose a Support Ticket',
        description: `Paste a WHOLE support ticket (mixed prose + logs, Chinese or English) and get a triaged diagnosis: detected board/SKU, error fingerprints, matched troubleshooting/knowledge, triage level (L1 self-serve / L2 need-info / L3 hardware-risk RMA) and a ready-to-send Chinese customer reply. L3 replies never advise self-fixing - hardware safety first. Local only; no ticket-system integration.`,
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Full ticket text including any error logs (max 32KB)',
            },
          },
          required: ['text'],
        },
      },
      {
        name: 'list_boards',
        title: 'List All XIAO Boards',
        description: `List all supported XIAO boards with their key specifications. Use this to help users choose the right board for their project.`,
        inputSchema: {
          type: 'object',
          properties: {},
        },
        annotations: { readOnlyHint: true },
      },
      {
        name: 'get_quickstart',
        title: 'Get Quick Start Guide',
        description: `Get a getting-started guide for a specific XIAO board. Includes IDE setup instructions, board package installation, and first program upload steps.`,
        inputSchema: {
          type: 'object',
          properties: {
            board: {
              type: 'string',
              description: 'Board ID (e.g. esp32c3, rp2040, nrf52840)',
            },
          },
          required: ['board'],
        },
        annotations: { readOnlyHint: true },
      },
      {
        name: 'troubleshoot',
        title: 'Troubleshoot XIAO Issues',
        description: `Diagnose and fix common XIAO problems. Describe the symptoms you are experiencing and optionally specify which board you are using.

Covers: boot mode failures, USB driver issues, upload timeouts, WiFi problems, serial output issues, power/brownout, I2C detection, camera init, display issues, BLE connection drops, and more.

Returns diagnosis steps and solutions.`,
        inputSchema: {
          type: 'object',
          properties: {
            symptoms: {
              type: 'string',
              description:
                'Description of the problem (e.g. "upload fails", "no serial port", "WiFi not connecting", "board not detected")',
            },
            board: {
              type: 'string',
              description: 'Optional board ID to narrow down solutions',
            },
          },
          required: ['symptoms'],
        },
        annotations: { readOnlyHint: true },
      },
      {
        name: 'search_wiki',
        title: 'Search XIAO Wiki',
        description: `Search wiki.seeedstudio.com for XIAO documentation. Use this when local examples and docs do not cover the user query, or for the latest documentation.`,
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query for the XIAO wiki',
            },
          },
          required: ['query'],
        },
        annotations: { readOnlyHint: true },
      },
      {
        name: 'search_knowledge',
        title: 'Search XIAO Internal Knowledge',
        description: `Search internal knowledge base for advanced XIAO topics, hard-to-solve problems, and real-world experience from customer support. This includes issues not documented in public wiki, such as:
- Low power optimization tricks and deep sleep gotchas
- Hardware-specific quirks (GPIO hold, USB CDC, PSRAM usage)
- WiFi/BLE coexistence issues
- Voltage level compatibility warnings
- Battery management tips

Returns detailed problem descriptions, solutions, and often working code.`,
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description:
                'Search query (e.g. "deep sleep gpio", "battery voltage", "psram", "ble mac address")',
            },
            board: {
              type: 'string',
              description: 'Optional board ID to filter results',
            },
          },
          required: ['query'],
        },
        annotations: { readOnlyHint: true },
      },
    ],
  }));

  // NOTE: the SDK validates the tools/call envelope before our handler runs.
  // Malformed envelopes (arguments: null, name: 123) come back as -32603 with
  // a bounded zod message from the SDK (its InvalidParams branch is unreachable
  // for envelope failures). Value-level validation below.
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;
    // Zero-arg tools (list_boards) may legally omit "arguments" entirely.
    const a: Record<string, unknown> = request.params.arguments ?? {};

    // Bounded echo for error messages: never replay more than 60 chars of input.
    const short = (v: unknown): string =>
      typeof v === 'string' ? (v.length > 60 ? v.slice(0, 60) + '…' : v) : String(v);

    // Typed accessor: malformed arguments are the caller's fault (InvalidParams),
    // not an internal error.
    const str = (key: string, required = true): string | undefined => {
      const v = a[key];
      if (v === undefined || v === null) {
        if (required)
          throw new McpError(ErrorCode.InvalidParams, `Missing required argument: ${key}`);
        return undefined;
      }
      if (typeof v !== 'string')
        throw new McpError(ErrorCode.InvalidParams, `Argument "${key}" must be a string`);
      if (v.length > 200)
        throw new McpError(
          ErrorCode.InvalidParams,
          `Argument "${key}" too long (${v.length} chars, max 200)`
        );
      return v;
    };

    try {
      switch (name) {
        case 'resolve_board': {
          const query = str('query') as string;
          // Queries containing "xiao" hit every fullName; cap the response so the
          // caller gets the best matches, not the whole catalog.
          const boards = assistant.resolveBoard(query).slice(0, 5);
          if (boards.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No XIAO boards found matching "${query}". Use list_boards to see all available boards.`,
                },
              ],
            };
          }
          return {
            content: [
              {
                type: 'text',
                text:
                  `Best match${boards.length > 1 ? 'es' : ''} for "${query}" (top ${boards.length}, best first):\n\n` +
                  boards
                    .map(
                      (b: XIAOBoard, i: number) =>
                        `${i === 0 ? '**⭐ BEST MATCH** — ' : ''}## ${b.fullName}\n` +
                        `- **Board ID**: ${b.id}\n` +
                        `- **MCU**: ${b.microcontroller} (${b.architecture}) @ ${b.clockSpeed}\n` +
                        `- **Flash/RAM**: ${b.flashSize} / ${b.ramSize}\n` +
                        `- **Connectivity**: ${b.connectivity.join(', ') || 'None'}\n` +
                        (b.lowPowerMode ? `- **Low power**: ${b.lowPowerMode}\n` : '') +
                        `- **Sensors**: ${b.builtinSensors.join(', ') || 'None'}\n` +
                        `- **Languages**: ${b.supportedLanguages.join(', ')}\n` +
                        `- **Wiki**: ${b.wikiUrl}`
                    )
                    .join('\n\n---\n\n'),
              },
            ],
          };
        }

        case 'get_board_info': {
          const board = assistant.getBoard(str('board') as string);
          if (!board) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `Board "${short(a.board)}" not found. Use resolve_board or list_boards first.`
            );
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(board, null, 2) }],
          };
        }

        case 'get_pinout': {
          const boardName = str('board') as string;
          const board = assistant.getBoard(boardName);
          if (!board) {
            // Unknown board is a caller error, not an internal one.
            throw new McpError(
              ErrorCode.InvalidParams,
              `Board "${short(a.board)}" not found. Use resolve_board or list_boards first.`
            );
          }
          return {
            content: [{ type: 'text', text: assistant.getPinout(boardName) }],
          };
        }

        case 'search_examples': {
          const opts: { language?: string; board?: string } = {};
          const language = str('language', false);
          if (language) opts.language = language;
          const boardFilter = str('board', false);
          if (boardFilter) opts.board = boardFilter;
          const q0 = str('query') as string;
          const examples = assistant.searchExamples(q0, opts);
          recordQuery({
            tool: 'search_examples',
            query: q0,
            board: opts.board,
            hits: examples.length,
            matched: examples.slice(0, 5).map((e) => e.id),
          });
          if (examples.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No examples found for "${a.query}". Try broader terms like "wifi", "sensor", "blink", or "bluetooth".`,
                },
              ],
            };
          }
          // Full code for the top hits only; the rest are one-liners so a broad
          // query can't flood the model's context with dozens of full sources.
          const FULL_CODE_LIMIT = 3;
          const top = examples.slice(0, FULL_CODE_LIMIT);
          const rest = examples.slice(FULL_CODE_LIMIT);
          const text =
            top
              .map(
                (ex: XIAOExample) =>
                  `## ${ex.title}\n` +
                  `**ID**: \`${ex.id}\`\n\n` +
                  `${ex.description}\n\n` +
                  `**Language**: ${ex.language} | **Category**: ${ex.category} | **Boards**: ${ex.boards.join(', ')}\n` +
                  (ex.requirements?.length
                    ? `**Requirements**: ${ex.requirements.join(', ')}\n`
                    : '') +
                  `\n\`\`\`${ex.language === 'arduino' || ex.language === 'zephyr' ? 'cpp' : 'python'}\n${ex.code}\n\`\`\``
              )
              .join('\n\n---\n\n') +
            (rest.length > 0
              ? `\n\n---\n\n**More matches** (use get_example with the id to fetch full code):\n` +
                rest
                  .map((ex: XIAOExample) => `- ${ex.title} (\`${ex.id}\`) — ${ex.description}`)
                  .join('\n')
              : '');
          return {
            content: [{ type: 'text', text }],
          };
        }

        case 'get_example': {
          const example = assistant.getExampleById(str('id') as string);
          if (!example) {
            throw new McpError(ErrorCode.InvalidParams, `Example "${short(a.id)}" not found.`);
          }
          return {
            content: [
              {
                type: 'text',
                text:
                  `## ${example.title}\n` +
                  `${example.description}\n\n` +
                  `**Language**: ${example.language} | **Category**: ${example.category} | **Boards**: ${example.boards.join(', ')}\n` +
                  (example.requirements?.length
                    ? `**Requirements**: ${example.requirements.join(', ')}\n`
                    : '') +
                  (example.wikiUrl ? `**Wiki**: ${example.wikiUrl}\n` : '') +
                  `\n\`\`\`${example.language === 'arduino' || example.language === 'zephyr' ? 'cpp' : 'python'}\n${example.code}\n\`\`\``,
              },
            ],
          };
        }

        case 'compile_sketch': {
          const boardName = str('board') as string;
          const boardInfo = assistant.getBoard(boardName);
          if (!boardInfo) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `Board "${short(a.board)}" not found. Use resolve_board first.`
            );
          }
          const exampleId = str('exampleId', false);
          const rawCode = a.code;
          if (exampleId && rawCode !== undefined) {
            throw new McpError(ErrorCode.InvalidParams, 'Pass either code or exampleId, not both.');
          }
          let code: string;
          let sketchName: string;
          if (exampleId) {
            const ex = assistant.getExampleById(exampleId);
            if (!ex)
              throw new McpError(
                ErrorCode.InvalidParams,
                `Example "${short(exampleId)}" not found.`
              );
            if (ex.language !== 'arduino') {
              throw new McpError(
                ErrorCode.InvalidParams,
                `Example is ${ex.language}; compile_sketch handles arduino only.`
              );
            }
            code = ex.code;
            sketchName = ex.id;
          } else if (typeof rawCode === 'string') {
            if (rawCode.length > 64 * 1024) {
              throw new McpError(
                ErrorCode.InvalidParams,
                `code too large (${rawCode.length} bytes, max 65536).`
              );
            }
            code = rawCode;
            sketchName = 'mcp-sketch';
          } else {
            throw new McpError(ErrorCode.InvalidParams, 'Provide code (string) or exampleId.');
          }
          const res = compileSketch({ board: boardInfo, sketchName, code, cliPath: 'arduino-cli' });
          if (res.ok) {
            return {
              content: [
                {
                  type: 'text',
                  text:
                    `✅ **${sketchName} compiles for ${boardInfo.fullName}**\n` +
                    `- FQBN: \`${res.fqbn}\`${res.discovered ? ' (discovered from installed cores)' : ''}\n` +
                    (res.sizeLine ? `- ${res.sizeLine}\n` : '') +
                    "\nThe sketch will build the same way in the user's Arduino IDE.",
                },
              ],
            };
          }
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text:
                  `❌ **compile failed** for ${boardInfo.fullName} (FQBN \`${res.fqbn || 'unresolved'}\`)\n\n` +
                  res.errors.map((e) => `- ${e}`).join('\n'),
              },
            ],
          };
        }

        case 'diagnose_ticket': {
          const text = str('text') as string;
          if (text.length > 32 * 1024) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `text too large (${text.length} bytes, max 32768).`
            );
          }
          const analysis = analyzeTicket(text, assistant);
          recordQuery({
            tool: 'ticket',
            query: analysis.fingerprints.join('+') || '(no-fingerprint)',
            board: analysis.detectedBoards[0],
            hits: analysis.matches.troubleshooting.length + analysis.matches.knowledge.length,
            matched: [
              ...analysis.matches.troubleshooting.map((e) => e.id),
              ...analysis.matches.knowledge.map((k) => k.id),
            ],
          });
          const triageDesc: Record<string, string> = {
            'L1-selfserve': 'L1 - self-serve: knowledge matched, reply below is ready to send',
            'L2-need-info': 'L2 - insufficient info: ask the follow-up questions below',
            'L3-hardware':
              'L3 - HARDWARE RISK: instruct the customer to STOP powering the board and go through RMA',
          };
          return {
            content: [
              {
                type: 'text',
                text:
                  `## Triage: ${triageDesc[analysis.triage]}\n\n` +
                  `- **Boards**: ${analysis.detectedBoards.join(', ') || 'not detected'}${analysis.detectedSkus.length ? ` (SKU ${analysis.detectedSkus.join(', ')})` : ''}\n` +
                  `- **Fingerprints**: ${analysis.fingerprints.join(' + ') || 'none'}\n` +
                  `- **Matched**: ${[...analysis.matches.troubleshooting.map((e) => e.id), ...analysis.matches.knowledge.map((k) => k.id)].join(', ') || 'none'}\n\n` +
                  `### Ready-to-send reply (Chinese)\n\n${analysis.reply}` +
                  (analysis.followUp.length > 0
                    ? `\n\n### Ask the customer\n${analysis.followUp.map((q) => `- ${q}`).join('\n')}`
                    : ''),
              },
            ],
          };
        }

        case 'list_boards': {
          const boards = assistant.getAllBoards();
          return {
            content: [
              {
                type: 'text',
                text:
                  `# Supported XIAO Boards (${boards.length})\n\n` +
                  boards
                    .map(
                      (b: XIAOBoard) =>
                        `- **${b.fullName}** (\`${b.id}\`): ${b.microcontroller} @ ${b.clockSpeed}, ${b.connectivity.join(', ') || 'No RF'}`
                    )
                    .join('\n'),
              },
            ],
          };
        }

        case 'get_quickstart': {
          const doc = assistant.getQuickstart(str('board') as string);
          if (!doc) {
            const board = assistant.getBoard(str('board') as string);
            return {
              content: [
                {
                  type: 'text',
                  text: board
                    ? `No quickstart guide available for ${board.fullName}. Visit the wiki: ${board.wikiUrl}`
                    : `Board "${short(a.board)}" not found. Use resolve_board first.`,
                },
              ],
            };
          }
          return {
            content: [{ type: 'text', text: doc.content }],
          };
        }

        case 'troubleshoot': {
          const symptoms = str('symptoms') as string;
          const board = str('board', false);
          const entries = assistant.troubleshoot(symptoms, board);
          const kb = assistant
            .searchKnowledge(symptoms, board ? { board } : undefined)
            .filter((k: XIAOKnowledge) => !entries.some((e) => e.id === k.id))
            .slice(0, 2);
          recordQuery({
            tool: 'troubleshoot',
            query: symptoms,
            board: board ?? undefined,
            hits: entries.length + kb.length,
            matched: [...entries.slice(0, 5).map((e) => e.id), ...kb.map((k) => k.id)],
          });

          if (entries.length === 0) {
            const fallbackKnowledge = kb;
            if (fallbackKnowledge.length > 0) {
              return {
                content: [
                  {
                    type: 'text',
                    text:
                      `No generic troubleshooting entry for "${symptoms}", but internal knowledge matches:\n\n` +
                      fallbackKnowledge
                        .map(
                          (k: XIAOKnowledge) =>
                            `### ${k.title}\n` +
                            `**Severity**: ${k.severity} | **Boards**: ${k.boards.join(', ') || 'all'}\n\n` +
                            `**Problem**: ${k.problem}\n\n**Fix**: ${k.solution}` +
                            (k.code ? `\n\n\`\`\`cpp\n${k.code}\n\`\`\`` : '')
                        )
                        .join('\n\n'),
                  },
                ],
              };
            }
            const wikiResults = await assistant.searchWikiOnline(symptoms);
            if (wikiResults.length > 0) {
              return {
                content: [
                  {
                    type: 'text',
                    text:
                      `No local troubleshooting entries found for "${symptoms}". Here are relevant wiki results:\n\n` +
                      wikiResults
                        .map((r: WikiSearchResult) => `### ${r.title}\n${r.snippet}\n🔗 ${r.url}`)
                        .join('\n\n'),
                  },
                ],
              };
            }
            return {
              content: [
                {
                  type: 'text',
                  text: `No troubleshooting entries found for "${symptoms}". Try describing the issue differently, or search the wiki with search_wiki.`,
                },
              ],
            };
          }

          // Merge internal-knowledge hits: the exact error text often lives in a
          // knowledge entry's problem field with a compile-verified fix.
          const knowledge = kb;

          return {
            content: [
              {
                type: 'text',
                text:
                  entries
                    .map(
                      (e: XIAOTroubleshootEntry) =>
                        `## ${e.title}\n\n` +
                        `**Category**: ${e.category}\n` +
                        `**Applies to**: ${e.boards.join(', ')}\n\n` +
                        `### Diagnosis\n${e.diagnosis.map((d: string) => `- ${d}`).join('\n')}\n\n` +
                        `### Solutions\n${e.solutions.map((s: string) => `- ${s}`).join('\n')}` +
                        (e.wikiUrl ? `\n\n📖 [More info](${e.wikiUrl})` : '')
                    )
                    .join('\n\n---\n\n') +
                  (knowledge.length > 0
                    ? '\n\n---\n\n## Internal knowledge\n\n' +
                      knowledge
                        .map(
                          (k: XIAOKnowledge) =>
                            `### ${k.title}\n` +
                            `**Severity**: ${k.severity} | **Boards**: ${k.boards.join(', ') || 'all'}\n\n` +
                            `${k.summary}\n\n**Fix**: ${k.solution}` +
                            (k.code ? `\n\n\`\`\`cpp\n${k.code}\n\`\`\`` : '')
                        )
                        .join('\n\n')
                    : ''),
              },
            ],
          };
        }

        case 'search_wiki': {
          const query = str('query') as string;
          const results = await assistant.searchWikiOnline(query);
          recordQuery({ tool: 'search_wiki', query, hits: results.length, matched: [] });

          if (results.length === 0) {
            return {
              content: [{ type: 'text', text: `No wiki results found for "${query}".` }],
            };
          }

          return {
            content: [
              {
                type: 'text',
                text:
                  `# Wiki Results for "${query}"\n\n` +
                  results
                    .map((r: WikiSearchResult) => `### ${r.title}\n${r.snippet}\n🔗 ${r.url}`)
                    .join('\n\n'),
              },
            ],
          };
        }

        case 'search_knowledge': {
          const query = str('query') as string;
          const board = str('board', false);
          const entries = assistant.searchKnowledge(query, board ? { board } : undefined);
          recordQuery({
            tool: 'search_knowledge',
            query,
            board: board ?? undefined,
            hits: entries.length,
            matched: entries.slice(0, 5).map((k) => k.id),
          });

          if (entries.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No internal knowledge found for "${query}". Try related terms, or use search_wiki for public documentation.`,
                },
              ],
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: entries
                  .map(
                    (e: XIAOKnowledge) =>
                      `## ${e.title}\n\n` +
                      `**Severity**: ${e.severity} | **Category**: ${e.category} | **Source**: ${e.source}\n` +
                      `**Applies to**: ${e.boards.join(', ')}\n\n` +
                      `${e.summary}\n\n` +
                      `### Problem\n${e.problem}\n\n` +
                      `### Solution\n${e.solution}` +
                      (e.code ? `\n\n\`\`\`cpp\n${e.code}\n\`\`\`` : '') +
                      (e.workaround ? `\n\n### Workaround\n${e.workaround}` : '')
                  )
                  .join('\n\n---\n\n'),
              },
            ],
          };
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    } catch (error) {
      if (error instanceof McpError) throw error;
      throw new McpError(ErrorCode.InternalError, `Internal error: ${error}`);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('XIAO Assistant MCP server running on stdio');
}
