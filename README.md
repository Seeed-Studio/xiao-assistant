# XIAO Assistant

[![NPM Version](https://img.shields.io/npm/v/%40seeedstudio%2Fxiao-cli?color=blue)](https://www.npmjs.com/package/@seeedstudio/xiao-cli) [![MIT licensed](https://img.shields.io/npm/l/%40seeedstudio%2Fxiao-cli)](./LICENSE)

XIAO Assistant - AI-powered development tools for Seeed Studio XIAO series boards.

## Features

- **📚 Up-to-date Documentation**: Latest XIAO development guides, pinouts, and specifications
- **💻 Multi-language Support**: Arduino, MicroPython, CircuitPython
- **🤖 AI Integration**: Native support for AI coding assistants (Cursor, Claude Code, etc.)
- **🛠️ Developer Tools**: CLI tools, SDK, and MCP server
- **📖 Code Examples**: Practical examples for common XIAO applications

## Installation

```bash
npm install -g @seeedstudio/xiao-cli
# or
pnpm add -g @seeedstudio/xiao-cli
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
xiao example blink
```

## AI Assistant Integration

### MCP Server
Register the XIAO Assistant MCP server in your AI coding tool:

```json
{
  "mcpServers": {
    "xiao-assistant": {
      "command": "npx",
      "args": ["@seeedstudio/xiao-mcp"]
    }
  }
}
```

### Usage in Prompts
```
Show me how to connect a DHT11 sensor to XIAO ESP32C3. use xiao
```

## Supported Boards

- XIAO ESP32C3
- XIAO ESP32S3
- XIAO RP2040
- XIAO nRF52840
- XIAO SAMD21
- And more...

## Development

This is a monorepo managed with pnpm workspaces.

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Type checking
pnpm typecheck
```

## Packages

- **[@seeedstudio/xiao-cli](./packages/cli)** - Command-line interface
- **[@seeedstudio/xiao-mcp](./packages/mcp)** - MCP server for AI assistants
- **[@seeedstudio/xiao-sdk](./packages/sdk)** - JavaScript/TypeScript SDK

## Contributing

Contributions are welcome! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

## License

MIT © [Seeed Studio](https://www.seeedstudio.com)

## Related Links

- [Seeed Studio XIAO Series](https://www.seeedstudio.com/xiao-series-c-1339.html)
- [XIAO Wiki](https://wiki.seeedstudio.com/XIAO_WiFi/)
- [Arduino Core for XIAO](https://github.com/Seeed-Studio/ArduinoCore-XIAO-mbed)