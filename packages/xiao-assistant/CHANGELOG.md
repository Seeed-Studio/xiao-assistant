# @seeed-studio/xiao-assistant

## 0.1.0

### Minor Changes

- ad0e865: First feature release since 0.0.3 — the package was audited end-to-end (two adversarial verification rounds, every finding reproduced and fixed) and now actually delivers what the README promises.

  **Boards & data**
  - 17 boards: official comparison table fully covered, plus the new ESP32-C5 (dual-band Wi-Fi 6) and nRF54LM20A / Sense (BLE 6.0, nPM1300); SKUs cross-checked
  - Serial pins corrected across 10 boards (SPI/I2C/UART templates were wrong — users wiring from them would have failed); every value re-verified against the official wiki pin maps
  - Deep-sleep power data on 16 boards (nRF52840 5 µA, MG24 1.95 µA, nRF54LM20A 4.76 µA + 0.33 µA ship mode, S3-Sense 3 mA camera-rail gotcha), surfaced in pinout and board resolution
  - 64 examples: all `Serial.printf` made portable across cores, statement-level semicolon gate in CI, ESP32C3 never paired with `LED_BUILTIN` (no onboard LED — templates explain the external-LED wiring), camera sketches carry inlined official pin maps
  - Harmful advice removed (CP210x/CH340 for native-USB boards, `/dev/ttyUSB0` → `/dev/ttyACM0`)

  **Search**
  - MiniSearch backend: fuzzy + prefix (misspellings now return results), field boosts, synonym expansion with Chinese aliases and CJK-compound matching (蓝牙 / 低功耗 / 上传失败 all work)

  **MCP**
  - SDK 0.5 → 1.30 (protocol 2025-06-18, clears the high-severity advisory); 10 tools (new `get_example`); typed argument validation with bounded error echo; `resolve_board` capped at 5 with best-match marker and power-aware natural-language ranking

  **CLI**
  - New: `xiao troubleshoot`, non-interactive `xiao init --board/--lang/--name/--yes`, fuzzy board name resolution, `LOW POWER` line in pinouts
  - Fixed: npm-global invocation (symlink silently exited 0), exit codes on every error path, boards table alignment, knowledge editor hardening (localhost-only, Host/Origin validation, path-traversal proof, global-id dedup, soft delete into `.trash/`)

  **Packaging & CI**
  - Side-effect-free SDK entry (`import { XIAOAssistant }` just works), main/exports/types/engines, LICENSE shipped
  - 37 tests (schema, cross-refs, pin regressions, example-code gates), 0 known vulnerabilities, publint clean, weekly wiki watchdog + Renovate
