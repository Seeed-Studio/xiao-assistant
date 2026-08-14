/**
 * Wiki board-coverage watchdog.
 *
 * The wiki (wiki.seeedstudio.com, Docusaurus) publishes a sitemap. New XIAO
 * board series show up there as getting-started pages before anyone updates
 * this repo. This script diffs the sitemap's XIAO pages against
 * data/boards/*.yaml and prints a drift report; exit 1 when new boards are
 * found so CI can open an issue.
 *
 * Usage: pnpm sync:wiki          (from packages/xiao-assistant)
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITEMAP = 'https://wiki.seeedstudio.com/sitemap.xml';
const WIKI_BASE = 'https://wiki.seeedstudio.com/';

function loadBoardIds() {
  const dir = join(pkgRoot, 'data', 'boards');
  const ids = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.yaml')) continue;
    for (const b of parse(readFileSync(join(dir, f), 'utf-8'))) ids.push(b.id);
  }
  return ids;
}

/** Getting-started style slugs: "xiao_<chip>[_suffix]_getting_started" etc. */
function extractBoardSlugs(urls) {
  // Accessories / kits that are not XIAO MCU boards.
  const ACCESSORY = /debug[-_]?mate|epaper|e-paper|panel|shield|adapter|expansion|kit|base|exhibition|gadget|w5500|halow|controller|logger/i;
  return urls
    .filter((u) => u.startsWith(WIKI_BASE) && u !== WIKI_BASE)
    .map((url) => ({ url, slug: url.slice(WIKI_BASE.length).replace(/\/+$/, '') }))
    .filter(({ slug }) =>
      /^(xiao[-_].*|XIAO[-_].*|getting[-_]?started[-_]?(with[-_]?)?(seeed[-_]?studio[-_]?)?xiao.*)$/i.test(
        slug
      )
    )
    .filter(({ slug }) => /getting.?started|pin.?multiplexing|arduino|micropython|platformio/i.test(slug))
    .filter(({ slug }) => !ACCESSORY.test(slug));
}

/** Old MediaWiki-style series names that predate the current id scheme. */
const SLUG_ALIASES = {
  'ble-sense': 'nrf52840-sense',
  ble: 'nrf52840',
  'seeeduino-xiao': 'samd21',
};

/** Map a wiki slug to the board ids it likely documents, e.g. "xiao_esp32c5_..." -> esp32c5. */
function slugToKnownBoards(slug, boardIds) {
  const s = slug.toLowerCase().replace(/[^a-z0-9]/g, '');
  const hits = boardIds.filter((id) => s.includes(id.replace(/[^a-z0-9]/g, '')));
  if (hits.length > 0) return hits;
  // alias pass: "XIAO-BLE-Sense-..." -> "ble-sense" -> nrf52840-sense
  for (const [alias, id] of Object.entries(SLUG_ALIASES)) {
    if (s.includes(alias.replace(/[^a-z0-9]/g, '')) && boardIds.includes(id)) return [id];
  }
  return [];
}

async function main() {
  const boardIds = loadBoardIds();
  console.log(`Local data: ${boardIds.length} boards.\nFetching ${SITEMAP} ...`);

  const res = await fetch(SITEMAP, { headers: { Accept: 'application/xml' } });
  if (!res.ok) {
    console.error(`sitemap fetch failed: HTTP ${res.status}`);
    return 2;
  }
  const xml = await res.text();
  const urls = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)]
    .map((m) => m[1])
    .filter((u) => u !== undefined);

  const pages = extractBoardSlugs(urls);
  console.log(`Wiki XIAO doc pages found: ${pages.length}`);

  // Group wiki pages by the local board they map to; anything left over is a
  // series we do not know -> drift candidate.
  const unmapped = new Map();
  for (const p of pages) {
    const known = slugToKnownBoards(p.slug, boardIds);
    if (known.length === 0) {
      const series =
        p.slug
          .toLowerCase()
          .replace(/^getting[-_]?started[-_]?(with[-_]?)?(seeed[-_]?studio[-_]?)?/, '')
          .replace(/_.*$/, '') || p.slug;
      const list = unmapped.get(series) ?? [];
      list.push(p.url);
      unmapped.set(series, list);
    }
  }

  if (unmapped.size === 0) {
    console.log('\n✅ No unmapped XIAO wiki series — local board data covers everything found.');
    return 0;
  }

  console.log(`\n⚠️  ${unmapped.size} wiki XIAO series with NO local board entry:`);
  for (const [series, links] of [...unmapped.entries()].sort()) {
    console.log(`\n  - ${series} (${links.length} pages)`);
    for (const l of links.slice(0, 4)) console.log(`      ${l}`);
    if (links.length > 4) console.log(`      ... +${links.length - 4} more`);
  }
  console.log('\nAction: add data/boards/<id>.yaml entries from the wiki pages above.');
  return 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
