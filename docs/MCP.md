# MCP Integration

`xiao mcp` runs a [Model Context Protocol](https://modelcontextprotocol.io) stdio server exposing 10 read-only tools over the XIAO knowledge base. Protocol negotiation up to **2025-06-18**. All results are markdown text sized for LLM contexts (search returns top hits with full source; the rest are listed by id).

## Register the server

**Claude Code**

```bash
claude mcp add xiao-assistant -- npx -y @seeed-studio/xiao-assistant mcp
```

**Claude Desktop / Cursor / any JSON config**

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

**Local checkout**

```bash
node packages/xiao-assistant/dist/index.js mcp
```

## Tools

| Tool | Parameters | What it returns |
|---|---|---|
| `resolve_board` | `query` — any language, typos tolerated | Top 5 boards, best match marked ⭐. Indexes specs, connectivity, onboard sensors **and deep-sleep power data**, so requirement queries work: `"battery BLE under 10µA"`, `低功耗 蓝牙`. |
| `get_board_info` | `board` id | Full board record as JSON (pins, power, languages, wiki URL). |
| `get_pinout` | `board` id | Formatted pin/spec table. |
| `search_examples` | `query`; optional `language` (arduino/micropython/circuitpython/zephyr), `board` | Top 3 with complete source code, each headed by its **ID**; further matches listed by id. Chinese and fuzzy queries work (蓝牙, `temprature`). |
| `get_example` | `id` | One example with full source — use it for anything listed without code. |
| `list_boards` | — | All 17 boards, one line each. |
| `get_quickstart` | `board` id | Getting-started guide (IDE setup, first upload). |
| `troubleshoot` | `symptoms` — paste the exact error text; optional `board` | Diagnosis steps + solutions. Chinese symptom vocabulary supported (上传失败, 连不上). |
| `search_knowledge` | `query`; optional `board` | Field-tested problems from customer support with solutions and code. |
| `search_wiki` | `query` (English terms work best) | Live wiki.seeedstudio.com page links, fetched from the sitemap. |

## Behavior notes for client authors

- **Arguments are optional per the MCP spec** — calling `list_boards` without
  `arguments` is valid.
- Malformed input returns JSON-RPC `-32602` with a short, actionable message
  (missing argument, wrong type, or >200 chars). Values are never echoed back
  beyond 60 characters.
- Blank or garbage queries return an empty result (or a "no matches" text),
  never the whole catalog.
- Unknown boards → `-32602` suggesting `resolve_board`; unknown examples →
  `-32602` suggesting the id list.
- The server greets with `serverInfo.version` taken from package.json
  (`initialize` → negotiate normally).

## Example session

```
→ tools/call resolve_board      {"query": "xiao with camera"}
← ⭐ BEST MATCH — XIAO ESP32S3 Sense (id: esp32s3-sense) …

→ tools/call get_pinout         {"board": "esp32s3-sense"}
← pin table + "deep sleep ~3mA (camera/SD rail powered …)"

→ tools/call search_examples    {"query": "camera", "language": "arduino"}
← 3 full examples, each with an ID line

→ tools/call get_example        {"id": "camera-capture-arduino"}
← complete sketch
```

Pair the server with the bundled skill ([skills/xiao-assistant.md](../skills/xiao-assistant.md))
for model-side usage rules and hardware gotchas.


## Registry presence

| Directory | Status | Submit at |
|---|---|---|
| Smithery | `smithery.yaml` in repo root | https://smithery.ai/new (import from GitHub) |
| Glama | pending | https://glama.ai/register-mcp-server |
| Cursor directory | pending | https://cursor.com/docs (mcp.json snippet is in this README) |
| npm search | keywords cover esp32/mcp-server/pinout | — |
