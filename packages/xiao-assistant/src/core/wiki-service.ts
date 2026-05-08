import type { WikiSearchResult } from './types.js';

const WIKI_API = 'https://wiki.seeedstudio.com/api.php';
const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 3000;

const cache = new Map<string, { results: WikiSearchResult[]; timestamp: number }>();

export async function searchWiki(query: string): Promise<WikiSearchResult[]> {
  const cached = cache.get(query);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.results;
  }

  try {
    const params = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: query,
      format: 'json',
      srlimit: '5',
      origin: '*',
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(`${WIKI_API}?${params}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return [];
    }

    const data = await response.json() as {
      query?: { search?: Array<{ title: string; snippet: string }> };
    };

    const results: WikiSearchResult[] = (data.query?.search ?? []).map((item) => ({
      title: item.title,
      snippet: stripHtml(item.snippet),
      url: `https://wiki.seeedstudio.com/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
    }));

    cache.set(query, { results, timestamp: Date.now() });
    return results;
  } catch {
    return [];
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
