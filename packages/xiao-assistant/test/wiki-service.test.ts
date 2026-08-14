import { describe, it, expect, beforeEach } from 'vitest';
import { searchWiki, __setWikiIndexForTest } from '../src/core/wiki-service.js';

const FIXTURE = [
  { url: 'https://wiki.seeedstudio.com/xiao_nrf54l15_sense_pin_multiplexing/' },
  { url: 'https://wiki.seeedstudio.com/xiao_esp32c3_getting_started/' },
  { url: 'https://wiki.seeedstudio.com/xiao_esp32c3_bluetooth_usage/' },
  { url: 'https://wiki.seeedstudio.com/getting_started_xiao_ra4m1/' },
  { url: 'https://wiki.seeedstudio.com Grove_Shield_for_Seeeduino_XIAO/'.replace(' ', '_') },
];

beforeEach(() => {
  __setWikiIndexForTest(FIXTURE);
});

describe('searchWiki (offline fixture index)', () => {
  it('matches query terms against page slugs', async () => {
    const results = await searchWiki('nrf54l15 pin');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.url).toContain('xiao_nrf54l15_sense_pin_multiplexing');
  });

  it('prettifies titles (brand case)', async () => {
    const results = await searchWiki('nrf54l15');
    expect(results[0]?.title).toMatch(/nRF54L15/);
  });

  it('returns ESP in caps', async () => {
    const results = await searchWiki('esp32c3 bluetooth');
    expect(results[0]?.title).toMatch(/ESP32C3/);
  });

  it('returns [] when nothing matches', async () => {
    expect(await searchWiki('zzzqqqxxx999')).toEqual([]);
  });
});
