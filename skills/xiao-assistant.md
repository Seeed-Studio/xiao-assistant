# XIAO Assistant

You have access to the XIAO Assistant MCP server, which provides up-to-date documentation, pinouts, specifications, and code examples for Seeed Studio XIAO series microcontroller boards.

## When to Use

Use XIAO Assistant tools when the user asks about:
- Seeed Studio XIAO boards (any model)
- Pinouts, wiring, or GPIO configuration
- Code examples for XIAO (Arduino, MicroPython, CircuitPython)
- Board specifications, comparisons, or selection
- Getting started with XIAO development
- Connecting sensors, displays, or modules to XIAO

## How to Use

1. If the user mentions a specific board or requirements, call `resolve-board` first to get the exact board ID
2. Use `get_board_info` for detailed specifications
3. Use `get_pinout` for pin mapping diagrams
4. Use `search_examples` to find relevant code examples (always include the full code in your response)
5. Use `get_quickstart` for setup and installation guides
6. Use `list_boards` to help users choose a board

## Important Notes

- All XIAO boards use 3.3V logic - remind users not to apply 5V directly to pins
- When suggesting wiring, always reference the exact pin numbers from the pinout
- If the user doesn't specify a board, ask which one they're using
- Always prefer showing complete, working code examples from the search results
