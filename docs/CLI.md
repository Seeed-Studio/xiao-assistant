# CLI Reference

`xiao` ships with `@seeed-studio/xiao-assistant` (`npm i -g @seeed-studio/xiao-assistant`). Every command exits `0` on success and `1` on bad input (unknown board/example, invalid flags, port errors).

<!-- verifier:start -->
```
xiao init        [options]        scaffold a project (interactive or fully non-interactive)
xiao boards                       list all 17 supported boards
xiao pinout      <board>          pin table + specs + low-power data for one board
xiao search      <query> [opts]   search examples and docs (fuzzy, Chinese OK)
xiao example     <id>             print one example with its full source
xiao troubleshoot <symptoms>      diagnose problems from symptoms
xiao quickstart  <board>          IDE setup + first-upload guide
xiao verify      <board> [id]     compile an example with arduino-cli
xiao knowledge   [options]        launch the local knowledge editor (browser)
xiao mcp                          start the MCP stdio server for AI tools
```
<!-- verifier:end -->

## xiao init

```bash
xiao init                                  # interactive (board, language, name)
xiao init -b esp32c3 -l micropython -y     # non-interactive, everything from flags
xiao init -b nrf54lm20a -n my-node -l arduino
```

| Flag | Meaning |
|---|---|
| `-b, --board <id>` | board id (`xiao boards` to list); resolved fuzzily (`ESP32S3`, `esp32-s3` both work) |
| `-l, --lang <language>` | `arduino` \| `micropython` \| `circuitpython` (defaults to arduino with `-y`) |
| `-n, --name <name>` | project directory name — plain names only (no `/`, no absolute paths) |
| `-y, --yes` | skip prompts entirely; requires `--board` when not a TTY |

Templates adapt to the board: an esp32c3 project gets an **external LED on D10** template with a note that the board has no onboard user LED; MicroPython/CircuitPython templates blink D10 (`Pin(10)` / `board.D10`), which is valid on every XIAO.

## xiao boards

One-line-per-board table. `Total: 17 boards`.

## xiao pinout <board>

Prints specs, pin map, connectivity, onboard sensors, **low-power mode** and the wiki link. Board names are normalized — `esp32s3-sense`, `ESP32S3_SENSE` and `esp32s3sense` are all accepted.

> Pin values follow each board's official wiki presentation: classic XIAOs use
> D-numbers (D4=SDA … D10=MOSI); esp32c3 / rp2040 / rp2350 / esp32s3 rows use
> GPIO numbers where the wiki does. Read the printed table, don't assume.

## xiao search <query>

```bash
xiao search wifi
xiao search "deep sleep" --board esp32s3
xiao search 蓝牙 --lang arduino
xiao search temprature        # typos tolerated (fuzzy matching)
```

| Flag | Meaning |
|---|---|
| `-l, --lang <language>` | filter: arduino / micropython / circuitpython / zephyr (invalid value → exit 1) |
| `-b, --board <board>` | filter by board id (unknown board → exit 1) |
| `-d, --docs` | search documentation instead of examples |

Chinese queries work through synonym expansion (蓝牙→ble, 低功耗→deep sleep,
温度传感器→dht/bme280…). When local data has no hit, the wiki is searched and
page links are printed.

## xiao example <id>

Prints one example: metadata, compatible boards, requirements, full source
(comments highlighted) and the wiki link when present. Example ids surface in
`xiao search` output.

## xiao troubleshoot <symptoms>

```bash
xiao troubleshoot "upload fails Connecting..."
xiao troubleshoot "wifi 连不上" -b esp32c3
```

Matches the troubleshooting database with fuzzy + synonym expansion (English
and Chinese symptom vocabulary). Prints diagnosis steps and solutions for the
top 5 entries.

## xiao example <id> --sim

Exports an example as a Wokwi simulation project (sketch.ino + diagram.json +
README) — run code with zero hardware. Wokwi has native parts for XIAO
ESP32C3/C6/S3 (`board-xiao-esp32-c3|c6|s3`, verified against
docs.wokwi.com/diagram-format); ESP32C5 uses the DevKitC-1 stand-in and RP2040
uses the Pi Pico. Boards without Wokwi support (nRF/SAMD/MG24) are rejected
with a clear message.

```bash
xiao example blink-arduino --sim                    # auto-picks a supported board
xiao example camera-capture-arduino --sim           # esp32s3-sense native part
xiao example blink-arduino --sim --board rp2040     # explicit stand-in board
```

## xiao ticket

```bash
xiao ticket "整段工单文本..."      # 参数直传
xiao ticket -f ticket.txt          # 从文件读
cat ticket.txt | xiao ticket       # 管道
```

Pastes a whole support ticket (mixed prose + logs, zh/en) and returns: detected
board/SKU, error **fingerprints** (extracted first — full-blob search drowns
the signal), triage level, matched entries, and a ready-to-send Chinese reply.
L3 (发烫/短路/冒烟…) replies instruct the customer to stop powering the board
and go through RMA — never self-fix advice. Local pure function: no ticket
system integration; paste in, copy the reply out.

## xiao knowledge --stats

Prints query-log statistics from `~/.xiao-assistant/query-log.jsonl` (local
only, no telemetry): zero-hit backlog (= knowledge worth writing), top
queries, and which entries actually get matched. Knowledge entries also accept
`ticketUrl`/`createdAt`/`lastVerifiedAt` provenance fields.

## xiao knowledge

```bash
xiao knowledge              # http://127.0.0.1:3456, opens your browser
xiao knowledge -p 8080
```

Local-first web editor for the knowledge base.

- Binds **127.0.0.1 only**; rejects forged Host headers and cross-origin requests.
- Entries are validated before writing; ids must be unique across the whole
  knowledge directory (409 otherwise).
- Deletes are soft: entries move to `data/knowledge/.trash/` (timestamped),
  which is never loaded.
- Invalid ports (`abc`, `0`, `70000`) exit 1; a busy port prints a clear error
  and exits 1 (never a silent success).

## xiao mcp

Starts the MCP stdio server (protocol 2025-06-18, 10 tools). See
[MCP integration](./MCP.md).

## xiao quickstart <board>

Prints the board's getting-started guide (IDE setup, board package, first upload).

## xiao verify <board> [exampleId]

Compiles a served example into real firmware with arduino-cli — the same gate
the repo's own examples pass. FQBNs come from verified board data when present
(samd21 today) or are discovered at runtime via `arduino-cli board listall`
against YOUR installed cores, so no guessed board ids ship in data.

```bash
xiao verify samd21 blink-arduino          # real compile (needs the core installed)
xiao verify esp32c3 blink-arduino --dry-run  # print the plan only
xiao verify samd21 --cli /path/to/arduino-cli
```
