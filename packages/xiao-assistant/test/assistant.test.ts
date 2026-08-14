import { describe, it, expect } from 'vitest';
import { XIAOAssistant } from '../src/core/assistant.js';

const assistant = new XIAOAssistant();

describe('board resolution', () => {
  it('resolves exact ids case/separator-insensitively', () => {
    for (const id of ['esp32c3', 'ESP32C3', 'esp32-c3', 'ESP32_C3']) {
      const board = assistant.getBoard(id);
      expect(board?.id, id).toBe('esp32c3');
    }
  });

  it('resolves hyphenated -sense board ids (regression: normalized map keys)', () => {
    // getBoard strips separators from the query; map keys must be normalized
    // the same way or these ids never match.
    const cases: Array<[string, string]> = [
      ['esp32s3-sense', 'esp32s3-sense'],
      ['ESP32S3_SENSE', 'esp32s3-sense'],
      ['esp32s3sense', 'esp32s3-sense'],
      ['nrf52840-sense', 'nrf52840-sense'],
      ['mg24-sense', 'mg24-sense'],
      ['nrf54l15-sense', 'nrf54l15-sense'],
    ];
    for (const [query, expected] of cases) {
      expect(assistant.getBoard(query)?.id, query).toBe(expected);
    }
  });

  it('pinout works for -sense boards too', () => {
    expect(() => assistant.getPinout('esp32s3-sense')).not.toThrow();
    expect(assistant.getPinout('nrf54l15-sense')).toContain('nRF54L15');
  });

  it('returns undefined for unknown boards', () => {
    expect(assistant.getBoard('not-a-board')).toBeUndefined();
  });

  it('resolveBoard ranks camera boards first for "camera"', () => {
    const boards = assistant.resolveBoard('camera');
    expect(boards.length).toBeGreaterThan(0);
    expect(boards[0]?.builtinSensors.join(' ').toLowerCase()).toContain('camera');
  });

  it('resolveBoard returns [] for blank queries', () => {
    expect(assistant.resolveBoard('')).toEqual([]);
    expect(assistant.resolveBoard('   ')).toEqual([]);
  });
});

describe('example search', () => {
  it('finds wifi examples', () => {
    const results = assistant.searchExamples('wifi');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.category === 'communication' || results.length > 3).toBe(true);
  });

  it('filters by language', () => {
    const arduino = assistant.searchExamples('wifi', { language: 'arduino' });
    expect(arduino.length).toBeGreaterThan(0);
    for (const ex of arduino) expect(ex.language).toBe('arduino');
  });

  it('filters by board', () => {
    const forC3 = assistant.searchExamples('wifi', { board: 'esp32c3' });
    for (const ex of forC3) expect(ex.boards).toContain('esp32c3');
  });

  it('blank query returns [] instead of everything', () => {
    expect(assistant.searchExamples('')).toEqual([]);
    expect(assistant.searchExamples('  ')).toEqual([]);
  });

  it('nonsense query returns []', () => {
    expect(assistant.searchExamples('zzzqqqxxx999')).toEqual([]);
  });
});

describe('pinout rendering', () => {
  it('renders a pinout box with pin data', () => {
    const text = assistant.getPinout('esp32c3');
    expect(text).toContain('ESP32-C3');
    expect(text).toContain('I2C');
    expect(text).toContain('Wiki: https://wiki.seeedstudio.com');
  });

  it('throws a helpful error for unknown board', () => {
    expect(() => assistant.getPinout('nope')).toThrow(/not found/i);
  });
});

describe('pin data correctness (regression: 2026-08-14 adversarial audit found wrong SPI/I2C/UART templates)', () => {
  // Classic XIAO footprint by D-pin: D4=SDA D5=SCL D6=TX D7=RX D8=SCK D9=MISO D10=MOSI
  it('classic-footprint boards carry correct serial pins', () => {
    const expectClassic = (id: string) => {
      const b = assistant.getBoard(id);
      expect(b, id).toBeDefined();
      const i2c = b?.pins.i2c[0];
      const spi = b?.pins.spi[0];
      const uart = b?.pins.uart[0];
      expect([i2c?.sda, i2c?.scl], `${id} i2c`).toEqual([4, 5]);
      expect([spi?.mosi, spi?.miso, spi?.sck], `${id} spi`).toEqual([10, 9, 8]);
      expect([uart?.tx, uart?.rx], `${id} uart`).toEqual([6, 7]);
    };
    for (const id of ['esp32c6', 'esp32c5', 'mg24', 'mg24-sense', 'ra4m1', 'nrf52840', 'nrf52840-sense', 'samd21', 'nrf54l15']) {
      expectClassic(id);
    }
  });

  it('esp32c3 SPI matches official wiki (D10=MOSI D9=MISO D8=SCK)', () => {
    const spi = assistant.getBoard('esp32c3')?.pins.spi[0];
    expect([spi?.mosi, spi?.miso, spi?.sck]).toEqual([10, 9, 8]);
  });
});

describe('example board compatibility (regression: esp32c3 has NO onboard user LED)', () => {
  it('blink examples never list esp32c3', () => {
    for (const id of ['blink-arduino', 'blink-micropython', 'blink-circuitpython']) {
      const ex = assistant.getExampleById(id);
      expect(ex, id).toBeDefined();
      expect(ex?.boards.includes('esp32c3'), id).toBe(false);
    }
  });

  it('zephyr examples are tagged zephyr, not arduino', () => {
    const ex = assistant.getExampleById('ble-scan-zephyr-nrf54l15');
    expect(ex?.language).toBe('zephyr');
  });
});

describe('troubleshoot + knowledge + quickstart', () => {
  it('troubleshoot matches upload-failure symptoms', () => {
    const entries = assistant.troubleshoot('upload fails');
    expect(entries.length).toBeGreaterThan(0);
  });

  it('searchKnowledge finds deep sleep entries', () => {
    const entries = assistant.searchKnowledge('deep sleep');
    expect(entries.length).toBeGreaterThan(0);
  });

  it('getQuickstart returns a getting-started doc', () => {
    const doc = assistant.getQuickstart('esp32c3');
    expect(doc?.category).toBe('getting-started');
  });
});
