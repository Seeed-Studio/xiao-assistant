import type { XIAOExample } from '../types.js';

export const blinkExamples: XIAOExample[] = [
  {
    id: 'blink-arduino',
    title: 'LED Blink',
    description: 'Blink the onboard LED on any XIAO board using Arduino',
    language: 'arduino',
    boards: ['esp32c3', 'esp32s3', 'esp32s3-sense', 'esp32c6', 'rp2040', 'rp2350', 'nrf52840', 'nrf52840-sense', 'samd21', 'ra4m1', 'mg24', 'mg24-sense'],
    category: 'basics',
    code: `// LED Blink - XIAO Board
// The built-in LED pin varies by board:
//   SAMD21/RA4M1: LED_BUILTIN (usually pin 13 or user LED)
//   ESP32 series: LED_BUILTIN
//   RP2040/RP2350: LED_BUILTIN (pin 25)
//   nRF52840: LED_BUILTIN

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(1000);
  digitalWrite(LED_BUILTIN, LOW);
  delay(1000);
}`,
    requirements: [],
    wikiUrl: 'https://wiki.seeedstudio.com/SeeedStudio_XIAO_Series_Introduction/',
  },
  {
    id: 'blink-micropython',
    title: 'LED Blink (MicroPython)',
    description: 'Blink the onboard LED using MicroPython',
    language: 'micropython',
    boards: ['esp32c3', 'esp32s3', 'esp32s3-sense', 'esp32c6', 'rp2040', 'rp2350', 'nrf52840', 'nrf52840-sense', 'samd21'],
    category: 'basics',
    code: `# LED Blink - MicroPython for XIAO
from machine import Pin
import time

# Onboard LED pin (varies by board)
# ESP32C3/S3: usually pin 21 or LED_BUILTIN
# RP2040: pin 25
# nRF52840: pin 26
led = Pin("LED_BUILTIN", Pin.OUT)  # or use specific pin number

while True:
    led.on()
    time.sleep(1)
    led.off()
    time.sleep(1)`,
    requirements: ['MicroPython firmware'],
  },
  {
    id: 'blink-circuitpython',
    title: 'LED Blink (CircuitPython)',
    description: 'Blink the onboard LED using CircuitPython',
    language: 'circuitpython',
    boards: ['esp32c3', 'esp32s3', 'esp32s3-sense', 'esp32c6', 'rp2040', 'rp2350', 'nrf52840', 'nrf52840-sense', 'samd21'],
    category: 'basics',
    code: `# LED Blink - CircuitPython for XIAO
import board
import digitalio
import time

led = digitalio.DigitalInOut(board.LED)
led.direction = digitalio.Direction.OUTPUT

while True:
    led.value = True
    time.sleep(1)
    led.value = False
    time.sleep(1)`,
    requirements: ['CircuitPython firmware (8.x+)'],
  },
];
