import type { XIAODocument } from '../types.js';

export const allDocuments: XIAODocument[] = [
  {
    id: 'getting-started-esp32',
    title: 'Getting Started with XIAO ESP32 Series (Arduino)',
    content: `# Getting Started with XIAO ESP32 Series

## Prerequisites
- Arduino IDE 2.x (recommended)
- USB-C cable
- XIAO ESP32 board (ESP32C3, ESP32S3, or ESP32C6)

## Setup Arduino IDE

1. **Install ESP32 Board Package:**
   - Go to File > Preferences
   - Add this URL to "Additional Board Manager URLs":
     \`https://espressif.github.io/arduino-esp32/package_esp32_index.json\`
   - Go to Tools > Board > Boards Manager
   - Search for "esp32" and install "esp32 by Espressif Systems"

2. **Select your board:**
   - Tools > Board > ESP32 Arduino > XIAO_ESP32C3 (or XIAO_ESP32S3, XIAO_ESP32C6)

3. **Select port:**
   - Tools > Port > select the COM port (Windows) or /dev/ttyUSBx (Linux/Mac)

4. **Upload a sketch:**
   - Open File > Examples > 01.Basics > Blink
   - Click the Upload button (→)

## Pin Assignment (XIAO ESP32C3)
All XIAO boards have 11 GPIO pins accessible through the header:
| Pin | Function | Notes |
|-----|----------|-------|
| D0  | GPIO0    | ADC, PWM |
| D1  | GPIO1    | ADC, PWM |
| D2  | GPIO2    | ADC, PWM |
| D3  | GPIO3    | SPI CS0, ADC, PWM |
| D4  | GPIO4    | ADC, PWM |
| D5  | GPIO5    | ADC, PWM |
| D6  | GPIO6    | I2C SDA, PWM |
| D7  | GPIO7    | I2C SCL, PWM |
| D8  | GPIO8    | SPI MISO, PWM |
| D9  | GPIO9    | SPI MOSI, PWM |
| D10 | GPIO10   | SPI SCK, PWM |

## Common Issues
- **Upload fails:** Hold the BOOT button while uploading, release when "Connecting..." appears
- **Port not showing:** Install CP210x or CH340 USB driver
- **WiFi not connecting:** Check SSID/password, ensure 2.4GHz network (not 5GHz)`,
    category: 'getting-started',
    boards: ['esp32c3', 'esp32s3', 'esp32s3-sense', 'esp32c6'],
    wikiUrl: 'https://wiki.seeedstudio.com/XIAO_ESP32C3_Getting_Started/',
  },
  {
    id: 'getting-started-rp2040',
    title: 'Getting Started with XIAO RP2040/RP2350',
    content: `# Getting Started with XIAO RP2040/RP2350

## Prerequisites
- Arduino IDE 2.x or Thonny (for MicroPython)
- USB-C cable

## Setup with Arduino IDE

1. **Install RP2040 Board Package:**
   - Go to File > Preferences
   - Add to "Additional Board Manager URLs":
     \`https://github.com/earlephilhower/arduino-pico/releases/download/global/package_rp2040_index.json\`
   - Go to Tools > Board > Boards Manager
   - Search "rp2040" and install "Raspberry Pi Pico/RP2040"

2. **Select board:**
   - Tools > Board > Raspberry Pi Pico/RP2040 > Seeed XIAO RP2040

## Setup with MicroPython (Thonny)

1. Download and install [Thonny IDE](https://thonny.org/)
2. Connect XIAO RP2040 via USB while holding BOOT button
3. In Thonny: Tools > Options > Interpreter > MicroPython (Raspberry Pi Pico)
4. Click "Install MicroPython" to flash firmware

## Setup with CircuitPython

1. Download CircuitPython UF2 from [circuitpython.org](https://circuitpython.org/board/seeeduino_xiao_rp2040/)
2. Hold BOOT button, connect USB, release BOOT
3. Drag the UF2 file to the RPI-RP2 drive that appears
4. After flashing, a CIRCUITPY drive appears`,
    category: 'getting-started',
    boards: ['rp2040', 'rp2350'],
    wikiUrl: 'https://wiki.seeedstudio.com/XIAO-RP2040/',
  },
  {
    id: 'getting-started-nrf52840',
    title: 'Getting Started with XIAO nRF52840',
    content: `# Getting Started with XIAO nRF52840 (Sense)

## Prerequisites
- Arduino IDE 2.x
- USB-C cable

## Setup Arduino IDE

1. **Install nRF52 Board Package:**
   - Go to File > Preferences
   - Add to "Additional Board Manager URLs":
     \`https://adafruit.github.io/arduino-board-index/package_adafruit_index.json\`
   - Boards Manager > search "adafruit nrf52" > install

2. **Select board:**
   - Tools > Board > Adafruit nRF52 > Seeed XIAO nRF52840

3. **Upload bootloader (first time):**
   - Tools > Programmer > Bootloader DFU for nRF52
   - Tools > Burn Bootloader
   - Wait for completion

## Using onboard sensors (Sense version)
The nRF52840 Sense includes:
- **LSM6DS3TR-C** 6-axis IMU (accelerometer + gyroscope)
- **MP34DT06J** MEMS microphone

Install required libraries:
- Adafruit LSM6DS
- PDM (for microphone)

## Bluetooth LE
The nRF52840 supports BLE 5.0. Use the ArduinoBLE library:
\`\`\`cpp
#include <ArduinoBLE.h>
\`\`\``,
    category: 'getting-started',
    boards: ['nrf52840', 'nrf52840-sense'],
    wikiUrl: 'https://wiki.seeedstudio.com/XIAO_BLE/',
  },
  {
    id: 'faq-general',
    title: 'XIAO FAQ',
    content: `# XIAO Series Frequently Asked Questions

## General

**Q: Which XIAO board should I choose?**
- Need WiFi? → ESP32C3 (budget), ESP32S3 (high performance), ESP32C6 (Matter/Thread)
- Need Bluetooth only? → nRF52840 or MG24
- Need low power? → MG24 (1.95μA), nRF52840 (5μA)
- Just getting started? → RP2040 or SAMD21 (simpler, no RF complexity)

**Q: What programming languages are supported?**
- Arduino (C/C++): All boards
- MicroPython: Most boards (ESP32, RP2040, nRF52840, SAMD21)
- CircuitPython: ESP32 series, RP2040, nRF52840, SAMD21
- PlatformIO: Most boards
- Zephyr RTOS: ESP32 series, nRF52840, nRF54L15

**Q: How do I enter boot mode?**
- Hold BOOT button → Connect USB → Release BOOT
- The board will appear as a mass storage device or enter download mode

**Q: Can I power XIAO with a battery?**
- Most XIAO boards support 3.7V LiPo battery via battery pads
- Boards with battery charging: ESP32 series, nRF52840, RP2350, RA4M1, MG24
- SAMD21 and RP2040 do NOT have onboard battery charging

**Q: What is the operating voltage?**
- All XIAO boards operate at 3.3V logic level
- USB-C provides 5V power
- Do NOT apply 5V to GPIO pins (use level shifters for 5V sensors)

**Q: How to use Grove sensors with XIAO?**
- Use a Grove Shield for XIAO (Seeed Studio accessory)
- Or connect Grove modules directly using jumper wires to the I2C/UART pins`,
    category: 'faq',
    boards: ['esp32c3', 'esp32s3', 'esp32s3-sense', 'esp32c6', 'rp2040', 'rp2350', 'nrf52840', 'nrf52840-sense', 'samd21', 'ra4m1', 'mg24', 'mg24-sense'],
    wikiUrl: 'https://wiki.seeedstudio.com/XIAO_FAQ/',
  },
];
