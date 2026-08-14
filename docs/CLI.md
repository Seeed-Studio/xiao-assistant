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
