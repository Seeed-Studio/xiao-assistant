import type { WikiSearchResult } from './types.js';

// wiki.seeedstudio.com migrated from MediaWiki to Docusaurus; the old
// api.php endpoint is gone. The sitemap is the only stable machine-readable
// index, so we fetch it once per process (24h TTL) and score URL slugs.
const WIKI_SITEMAP = 'https://wiki.seeedstudio.com/sitemap.xml';
const WIKI_BASE = 'https://wiki.seeedstudio.com/';
const INDEX_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const MAX_RESULTS = 5;

type WikiIndexEntry = { url: string; tokens: string[] };

let indexCache: { entries: WikiIndexEntry[]; timestamp: number } | null = null;
const resultCache = new Map<string, { results: WikiSearchResult[]; timestamp: number }>();
const RESULT_TTL_MS = 5 * 60 * 1000;

async function fetchSitemap(): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(WIKI_SITEMAP, {
      signal: controller.signal,
      headers: { Accept: 'application/xml' },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function slugToTokens(url: string): string[] {
  const slug = url.slice(WIKI_BASE.length).replace(/\/+$/, '');
  return decodeURIComponent(slug)
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter((t) => t.length > 1);
}

async function getWikiIndex(): Promise<WikiIndexEntry[]> {
  if (indexCache && Date.now() - indexCache.timestamp < INDEX_TTL_MS) {
    return indexCache.entries;
  }
  const xml = await fetchSitemap();
  if (!xml) return indexCache?.entries ?? [];

  const urls = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)]
    .map((m) => m[1])
    .filter((u): u is string => u !== undefined)
    .filter((u) => u.startsWith(WIKI_BASE) && u !== WIKI_BASE);
  const entries = urls.map((url) => ({ url, tokens: slugToTokens(url) }));

  indexCache = { entries, timestamp: Date.now() };
  return entries;
}

// Wiki page slugs are all-lowercase; restore recognizable brand/case names for display.
const ACRONYM_TOKENS: Record<string, string> = {
  xiao: 'XIAO',
  wifi: 'WiFi',
  ble: 'BLE',
  i2c: 'I2C',
  spi: 'SPI',
  uart: 'UART',
  usb: 'USB',
  usbc: 'USB-C',
  gpio: 'GPIO',
  oled: 'OLED',
  lora: 'LoRa',
  lorawan: 'LoRaWAN',
  rtc: 'RTC',
  gnss: 'GNSS',
  psram: 'PSRAM',
  mqtt: 'MQTT',
  http: 'HTTP',
  arduino: 'Arduino',
  micropython: 'MicroPython',
  circuitpython: 'CircuitPython',
  edge: 'Edge',
  ai: 'AI',
};

function prettifyToken(token: string): string {
  const known = ACRONYM_TOKENS[token];
  if (known) return known;
  if (/^esp/.test(token)) return token.toUpperCase(); // esp32c3 -> ESP32C3
  if (/^nrf\d/.test(token)) return `nRF${token.slice(3).toUpperCase()}`; // nrf52840 -> nRF52840
  if (/^mg\d/.test(token)) return `MG${token.slice(2)}`; // mg24 -> MG24
  if (/^ra\d/.test(token)) return `RA${token.slice(2)}`; // ra4m1 -> RA4M1
  if (/^rp\d/.test(token)) return `RP${token.slice(2)}`; // rp2040 -> RP2040
  if (/^samd/.test(token)) return token.toUpperCase(); // samd21 -> SAMD21
  return token.charAt(0).toUpperCase() + token.slice(1);
}

function titleFromUrl(url: string): string {
  const slug = url.slice(WIKI_BASE.length).replace(/\/+$/, '');
  return decodeURIComponent(slug).split(/[-_/]/).filter(Boolean).map(prettifyToken).join(' ');
}

export async function searchWiki(query: string): Promise<WikiSearchResult[]> {
  const cached = resultCache.get(query);
  if (cached && Date.now() - cached.timestamp < RESULT_TTL_MS) {
    return cached.results;
  }

  const index = await getWikiIndex();
  if (index.length === 0) return [];

  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9+一-鿿]+/)
    .filter((t) => t.length > 1);

  const scored: Array<{ entry: WikiIndexEntry; score: number }> = [];
  for (const entry of index) {
    let score = 0;
    for (const term of terms) {
      if (entry.tokens.includes(term)) score += 5;
      else if (entry.tokens.some((t) => t.includes(term) || term.includes(t))) score += 2;
    }
    // Require at least one exact token hit: pure substring noise (e.g. "nothing"
    // matching "hot") otherwise surfaces completely unrelated pages for
    // garbage/misspelled queries.
    if (score >= 5) scored.push({ entry, score });
  }

  const results: WikiSearchResult[] = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map(({ entry }) => ({
      title: titleFromUrl(entry.url),
      snippet: '',
      url: entry.url,
    }));

  resultCache.set(query, { results, timestamp: Date.now() });
  return results;
}

// Exported for tests: inject a fetched sitemap without hitting the network.
export function __setWikiIndexForTest(entries: Array<{ url: string }>): void {
  indexCache = {
    entries: entries.map((e) => ({ url: e.url, tokens: slugToTokens(e.url) })),
    timestamp: Date.now(),
  };
  resultCache.clear();
}
