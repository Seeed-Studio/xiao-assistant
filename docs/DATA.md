# Data Contribution Guide

Everything the tools serve lives in YAML under `packages/xiao-assistant/data/`. No build or re-index step — the loader picks up new files on next start.

```
data/
├── boards/            one YAML per board family, array of XIAOBoard
├── examples/          arrays of XIAOExample (subdirectories allowed)
├── docs/              getting-started guides (XIAODocument) + troubleshooting.yaml
├── knowledge/         XIAOKnowledge entries (+ .trash/ recycle bin — never edit)
└── synonyms.yaml      query expansion table (English keys + Chinese aliases)
```

## Ground rules

1. **Every fact comes from the official wiki.** Fetch the board's getting-started
   / pin-multiplexing page, verify each field against its pin map, and put the
   page URL in `wikiUrl`. Unverifiable numbers don't ship — this repo's pin data
   is audited against the wiki, and wrong pin numbers brick users' wiring.
2. **ids are globally unique per entity type** and kebab-case. The knowledge
   editor enforces this across files; the loader dedupes keep-first, but a
   duplicate id is still a bug.
3. **Cross-references must resolve**: every id in an `boards: [...]` array must
   exist in `data/boards/`, and every example language must be in that board's
   `supportedLanguages` (this mismatch has shipped before).
4. **Embedded code is real code.** The test suite statically gates every
   example: no `Serial.printf` (not portable to SAMD/RP2040/MG24 cores), every
   `Serial.print*` statement ends with a semicolon, parens/braces/quotes
   balance. `pnpm test` rejects violations.
5. Boards without a public wiki page are not added on speculation. Run
   `pnpm sync:wiki` to see which wiki series are still unmapped.

## Schemas (src/core/types.ts is the source of truth)

### XIAOBoard — data/boards/<family>.yaml

```yaml
- id: esp32c5                    # unique, kebab-case; -sense suffix for variants
  name: XIAO ESP32C5             # short name
  fullName: Seeed Studio XIAO ESP32-C5
  microcontroller: ESP32-C5
  architecture: RISC-V (32-bit)
  clockSpeed: 240 MHz
  flashSize: 8MB
  ramSize: 8MB PSRAM
  onboardFlash: 8MB Flash + 8MB PSRAM
  pins:
    digital: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    analog:  [0]
    pwm:     [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    i2c:  [{ sda: 4, scl: 5 }]   # classic footprint: D4=SDA D5=SCL
    spi:  [{ mosi: 10, miso: 9, sck: 8, cs: 3 }]
    uart: [{ tx: 6, rx: 7 }]
  features: [USB-C, Battery charging]
  connectivity: ["WiFi 6 (2.4GHz + 5GHz dual-band)", "Bluetooth 5", Zigbee, Thread]
  builtinSensors: []             # Sense variants: ["6-axis IMU", "Microphone"], …
  supportedLanguages: [arduino, micropython, platformio, zephyr]
  hasResetButton: true
  hasBootButton: true
  hasBatteryCharging: true
  lowPowerMode: not yet documented on the wiki   # verbatim from the comparison table
  wikiUrl: https://wiki.seeedstudio.com/xiao_esp32c5_getting_started/
  sku: '100010048'               # string — leading zeros
```

**Pin numbering convention.** Use the numbering the board's own wiki page leads
with: D-numbers for the classic footprint (`D4=SDA D5=SCL D6=TX D7=RX D8=SCK
D9=MISO D10=MOSI`); esp32c3 / rp2040 / rp2350 / esp32s3 rows keep the GPIO
numbers their wiki tables print. When a board has no D-silkscreen at all
(nRF54LM20A uses A0–A7), leave `i2c/spi/uart` empty rather than inventing
mappings and note it in a comment.

**Known traps.** XIAO ESP32C3 has no onboard user LED — never list it in a
`LED_BUILTIN` example. ESP32S3 is WiFi 4, not WiFi 6. ESP32S3 Sense deep sleep
is ~3 mA with the camera rail powered. Only take `lowPowerMode` values from the
official comparison table or the board's power page.

### XIAOExample — data/examples/<category>.yaml

```yaml
- id: oled-ssd1306-arduino       # id describes what it is (an old id claiming
  title: SSD1306 OLED Display    # "spi-display" for an I2C sketch was a bug)
  description: Display text on a 128x64 SSD1306 via I2C
  language: arduino              # arduino | micropython | circuitpython | zephyr
  boards: [esp32c3, esp32s3, rp2040]   # must exist AND support `language`
  category: displays
  tags: [oled, ssd1306, i2c]     # searchable; keep lowercase
  code: |
    #include <Wire.h>
    ...
  requirements: [Adafruit SSD1306]     # optional libraries
  wikiUrl: https://wiki.seeedstudio.com/...   # when adapted from a wiki page
```

### XIAODocument / XIAOTroubleshootEntry — data/docs/

Getting-started entries use `category: getting-started` and list board ids.
`troubleshooting.yaml` holds `symptoms`/`diagnosis`/`solutions` arrays — write
symptoms the way users actually paste them ("Connecting...", "no serial port"),
and keep advice board-accurate (native-USB ESP32s need no CP210x/CH340; the
Linux device is `/dev/ttyACM0`).

### XIAOKnowledge — data/knowledge/<category>.yaml

One file per category. `severity` ∈ easy|medium|hard, `source` ∈
support-ticket|internal-test|community|wiki. Prefer entries with a
`code:` fix — those are what make this database worth querying.

### synonyms.yaml

Keys expand queries: matching any key or synonym adds every term in the group
to the search. Keep Chinese aliases aligned with English keys (蓝牙 under
bluetooth), and remember matching is whole-word, whole-phrase, or CJK-substring
(上传失败 → 上传) — a synonym only fires if one of those three matches.

## Verification bar for data PRs

```bash
pnpm test        # schema/cross-ref/semicolon/pin-regression gates
pnpm sync:wiki   # board coverage vs the official wiki sitemap
```
