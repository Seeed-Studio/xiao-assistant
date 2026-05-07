#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { XIAOAssistant, type XIAOBoard, type XIAOExample } from '@seeedstudio/xiao-sdk';

const assistant = new XIAOAssistant();

const server = new Server(
  {
    name: 'xiao-assistant',
    version: '0.1.0',
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

Examples cover: LED blink, WiFi, Bluetooth, I2C, SPI, sensors, deep sleep, MQTT, camera, PWM, displays, and more.

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

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError(ErrorCode.InternalError, `Internal error: ${error}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('XIAO Assistant MCP server running on stdio');
}

main().catch(console.error);
