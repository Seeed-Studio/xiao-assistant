# XIAO Assistant

[![NPM Version](https://img.shields.io/npm/v/%40seeed-studio%2Fxiao-assistant?color=blue)](https://www.npmjs.com/package/@seeed-studio/xiao-assistant) [![MIT licensed](https://img.shields.io/npm/l/%40seeed-studio%2Fxiao-assistant)](./LICENSE)

XIAO Assistant - AI-powered development tools for Seeed Studio XIAO series boards.

## Features

- **14 XIAO Boards**: Full pinouts, specs, and quickstart guides
- **61 Code Examples**: WiFi, BLE, MQTT, sensors, displays, motors, and more
- **CLI Tools**: Initialize projects, search examples, view pinouts
- **MCP Server**: Native integration with Claude, Cursor, and other AI tools
- **Knowledge Base**: Internal troubleshooting experience from customer support
- **Wiki Fallback**: Auto-search wiki.seeedstudio.com when local data isn't enough

## Installation

```bash
npm install -g @seeed-studio/xiao-assistant
# or
pnpm add -g @seeed-studio/xiao-assistant
```

## Quick Start

```bash
# Initialize XIAO project
xiao init

# Get XIAO ESP32C3 pinout
xiao pinout esp32c3

# Search for sensor libraries
xiao search sensor

# Get coding examples
xiao example blink-arduino

# List all boards
xiao boards

# Launch knowledge editor
xiao knowledge
```

## AI Assistant Integration

### MCP Server

Start the MCP server:
```bash
xiao mcp
```

Register in your AI coding tool (Claude, Cursor, etc.):

```json
{
  "mcpServers": {
    "xiao-assistant": {
      "command": "npx",
      "args": ["-y", "@seeed-studio/xiao-assistant", "mcp"]
    }
  }
}
```

### 9 MCP Tools

- `resolve-board` - Find the right XIAO board
- `get_board_info` - Get full board specs
- `get_pinout` - Get pinout diagram
- `search_examples` - Search code examples
- `list_boards` - List all boards
- `get_quickstart` - Get getting-started guide
- `troubleshoot` - Diagnose common issues
- `search_wiki` - Search wiki.seeedstudio.com
- `search_knowledge` - Search internal knowledge base

## Supported Boards

- XIAO ESP32C3, ESP32S3, ESP32S3 Sense, ESP32C6
- XIAO RP2040, RP2350
- XIAO nRF52840, nRF52840 Sense
- XIAO SAMD21, RA4M1
- XIAO MG24, MG24 Sense
- XIAO nRF54L15, nRF54L15 Sense

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## License

MIT © [Seeed Studio](https://www.seeedstudio.com)
