#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { XIAOAssistant } from '@seeedstudio/xiao-sdk';

class XIAOMcpServer {
  private server: Server;
  private xiaoAssistant: XIAOAssistant;

  constructor() {
    this.xiaoAssistant = new XIAOAssistant();

    this.server = new Server(
      {
        name: 'xiao-assistant',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_board_info',
            description: 'Get information about a specific XIAO board',
            inputSchema: {
              type: 'object',
              properties: {
                board: {
                  type: 'string',
                  description: 'Board name (e.g., esp32c3, rp2040)',
                },
              },
              required: ['board'],
            },
          },
          {
            name: 'get_pinout',
            description: 'Get pinout diagram for a XIAO board',
            inputSchema: {
              type: 'object',
              properties: {
                board: {
                  type: 'string',
                  description: 'Board name (e.g., esp32c3, rp2040)',
                },
              },
              required: ['board'],
            },
          },
          {
            name: 'search_examples',
            description: 'Search for XIAO code examples',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query for examples',
                },
                language: {
                  type: 'string',
                  enum: ['arduino', 'micropython', 'circuitpython'],
                  description: 'Programming language',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'list_boards',
            description: 'List all supported XIAO boards',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'get_board_info':
            const board = this.xiaoAssistant.getBoard(args.board as string);
            if (!board) {
              throw new McpError(ErrorCode.InvalidParams, `Board ${args.board} not found`);
            }
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(board, null, 2),
                },
              ],
            };

          case 'get_pinout':
            const pinout = this.xiaoAssistant.getPinout(args.board as string);
            return {
              content: [
                {
                  type: 'text',
                  text: pinout,
                },
              ],
            };

          case 'search_examples':
            const examples = this.xiaoAssistant.searchExamples(args.query as string);
            return {
              content: [
                {
                  type: 'text',
                  text: `Found ${examples.length} examples for "${args.query}"`,
                },
              ],
            };

          case 'list_boards':
            const boards = this.xiaoAssistant.getAllBoards();
            return {
              content: [
                {
                  type: 'text',
                  text: `Supported XIAO boards:\n${boards.map(b => `- ${b.name}`).join('\n')}`,
                },
              ],
            };

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(ErrorCode.InternalError, `Internal error: ${error}`);
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('XIAO Assistant MCP server running on stdio');
  }
}

// Run the server
const server = new XIAOMcpServer();
server.run().catch(console.error);