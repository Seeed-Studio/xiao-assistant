import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { XIAOAssistant, type XIAOBoard, type XIAOExample, type XIAOTroubleshootEntry, type WikiSearchResult, type XIAOKnowledge } from '../core/assistant.js';

export async function startMcpServer() {
  const assistant = new XIAOAssistant();

  const server = new Server(
    {
      name: 'xiao-assistant',
      version: '0.2.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'resolve-board',
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
              description: 'Description of the board the user is looking for (e.g. "xiao esp32c3", "xiao with camera", "bluetooth xiao")',
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
              description: 'Board ID (e.g. esp32c3, esp32s3, rp2040, nrf52840, samd21). Use resolve-board first if unsure.',
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
              description: 'Search query (e.g. "wifi", "bluetooth", "temperature sensor", "oled display", "mqtt")',
            },
            language: {
              type: 'string',
              enum: ['arduino', 'micropython', 'circuitpython'],
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
              description: 'Description of the problem (e.g. "upload fails", "no serial port", "WiFi not connecting", "board not detected")',
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
              description: 'Search query (e.g. "deep sleep gpio", "battery voltage", "psram", "ble mac address")',
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

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (!args) {
      throw new McpError(ErrorCode.InvalidParams, 'Arguments are required');
    }

    try {
      switch (name) {
        case 'resolve-board': {
          const query = args.query as string;
          const boards = assistant.resolveBoard(query);
          if (boards.length === 0) {
            return {
              content: [{ type: 'text', text: `No XIAO boards found matching "${query}". Use list_boards to see all available boards.` }],
            };
          }
          return {
            content: [{
              type: 'text',
              text: boards.map((b: XIAOBoard) =>
                `## ${b.fullName}\n` +
                `- **Board ID**: ${b.id}\n` +
                `- **MCU**: ${b.microcontroller} (${b.architecture}) @ ${b.clockSpeed}\n` +
                `- **Flash/RAM**: ${b.flashSize} / ${b.ramSize}\n` +
                `- **Connectivity**: ${b.connectivity.join(', ') || 'None'}\n` +
                `- **Sensors**: ${b.builtinSensors.join(', ') || 'None'}\n` +
                `- **Languages**: ${b.supportedLanguages.join(', ')}\n` +
                `- **Wiki**: ${b.wikiUrl}`
              ).join('\n\n---\n\n'),
            }],
          };
        }

        case 'get_board_info': {
          const board = assistant.getBoard(args.board as string);
          if (!board) {
            throw new McpError(ErrorCode.InvalidParams, `Board "${args.board}" not found. Use resolve-board or list_boards first.`);
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(board, null, 2) }],
          };
        }

        case 'get_pinout': {
          const pinout = assistant.getPinout(args.board as string);
          return {
            content: [{ type: 'text', text: pinout }],
          };
        }

        case 'search_examples': {
          const opts: { language?: string; board?: string } = {};
          if (args.language) opts.language = args.language as string;
          if (args.board) opts.board = args.board as string;
          const examples = assistant.searchExamples(args.query as string, opts);
          if (examples.length === 0) {
            return {
              content: [{ type: 'text', text: `No examples found for "${args.query}". Try broader terms like "wifi", "sensor", "blink", or "bluetooth".` }],
            };
          }
          return {
            content: [{
              type: 'text',
              text: examples.map((ex: XIAOExample) =>
                `## ${ex.title}\n` +
                `${ex.description}\n\n` +
                `**Language**: ${ex.language} | **Category**: ${ex.category} | **Boards**: ${ex.boards.join(', ')}\n` +
                (ex.requirements?.length ? `**Requirements**: ${ex.requirements.join(', ')}\n` : '') +
                `\n\`\`\`${ex.language === 'arduino' ? 'cpp' : 'python'}\n${ex.code}\n\`\`\``
              ).join('\n\n---\n\n'),
            }],
          };
        }

        case 'list_boards': {
          const boards = assistant.getAllBoards();
          return {
            content: [{
              type: 'text',
              text: `# Supported XIAO Boards (${boards.length})\n\n` +
                boards.map((b: XIAOBoard) =>
                  `- **${b.fullName}** (\`${b.id}\`): ${b.microcontroller} @ ${b.clockSpeed}, ${b.connectivity.join(', ') || 'No RF'}`
                ).join('\n'),
            }],
          };
        }

        case 'get_quickstart': {
          const doc = assistant.getQuickstart(args.board as string);
          if (!doc) {
            const board = assistant.getBoard(args.board as string);
            return {
              content: [{
                type: 'text',
                text: board
                  ? `No quickstart guide available for ${board.fullName}. Visit the wiki: ${board.wikiUrl}`
                  : `Board "${args.board}" not found. Use resolve-board first.`,
              }],
            };
          }
          return {
            content: [{ type: 'text', text: doc.content }],
          };
        }

        case 'troubleshoot': {
          const symptoms = args.symptoms as string;
          const board = args.board as string | undefined;
          const entries = assistant.troubleshoot(symptoms, board);

          if (entries.length === 0) {
            const wikiResults = await assistant.searchWikiOnline(symptoms);
            if (wikiResults.length > 0) {
              return {
                content: [{
                  type: 'text',
                  text: `No local troubleshooting entries found for "${symptoms}". Here are relevant wiki results:\n\n` +
                    wikiResults.map((r: WikiSearchResult) =>
                      `### ${r.title}\n${r.snippet}\n🔗 ${r.url}`
                    ).join('\n\n'),
                }],
              };
            }
            return {
              content: [{ type: 'text', text: `No troubleshooting entries found for "${symptoms}". Try describing the issue differently, or search the wiki with search_wiki.` }],
            };
          }

          return {
            content: [{
              type: 'text',
              text: entries.map((e: XIAOTroubleshootEntry) =>
                `## ${e.title}\n\n` +
                `**Category**: ${e.category}\n` +
                `**Applies to**: ${e.boards.join(', ')}\n\n` +
                `### Diagnosis\n${e.diagnosis.map((d: string) => `- ${d}`).join('\n')}\n\n` +
                `### Solutions\n${e.solutions.map((s: string) => `- ${s}`).join('\n')}` +
                (e.wikiUrl ? `\n\n📖 [More info](${e.wikiUrl})` : '')
              ).join('\n\n---\n\n'),
            }],
          };
        }

        case 'search_wiki': {
          const query = args.query as string;
          const results = await assistant.searchWikiOnline(query);

          if (results.length === 0) {
            return {
              content: [{ type: 'text', text: `No wiki results found for "${query}".` }],
            };
          }

          return {
            content: [{
              type: 'text',
              text: `# Wiki Results for "${query}"\n\n` +
                results.map((r: WikiSearchResult) =>
                  `### ${r.title}\n${r.snippet}\n🔗 ${r.url}`
                ).join('\n\n'),
            }],
          };
        }

        case 'search_knowledge': {
          const query = args.query as string;
          const board = args.board as string | undefined;
          const entries = assistant.searchKnowledge(query, board ? { board } : undefined);

          if (entries.length === 0) {
            return {
              content: [{ type: 'text', text: `No internal knowledge found for "${query}". Try related terms, or use search_wiki for public documentation.` }],
            };
          }

          return {
            content: [{
              type: 'text',
              text: entries.map((e: XIAOKnowledge) =>
                `## ${e.title}\n\n` +
                `**Severity**: ${e.severity} | **Category**: ${e.category} | **Source**: ${e.source}\n` +
                `**Applies to**: ${e.boards.join(', ')}\n\n` +
                `${e.summary}\n\n` +
                `### Problem\n${e.problem}\n\n` +
                `### Solution\n${e.solution}` +
                (e.code ? `\n\n\`\`\`cpp\n${e.code}\n\`\`\`` : '') +
                (e.workaround ? `\n\n### Workaround\n${e.workaround}` : '')
              ).join('\n\n---\n\n'),
            }],
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
