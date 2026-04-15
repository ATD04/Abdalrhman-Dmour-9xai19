/**
 * Auto-translator: English → Arabic using MyMemory free API.
 * Results are cached indefinitely in localStorage so the API is only
 * called once per unique string per device.
 */

const CACHE_KEY = 'twin-ar-dict-v1';

function loadCache(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}'); }
  catch { return {}; }
}

function saveCache(additions: Record<string, string>) {
  try {
    const existing = loadCache();
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...existing, ...additions }));
  } catch {}
}

/** Returns a cached Arabic translation for `text`, or undefined if not cached. */
export function getCachedAr(text: string): string | undefined {
  return loadCache()[text];
}

/**
 * Translate an array of English strings to Arabic.
 * Already-cached strings are returned instantly; only novel strings hit the API.
 * Requests are batched (8 concurrent max) to avoid overloading the free tier.
 */
export async function translateToArabic(texts: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(texts.filter(t => t?.trim()))];
  const result: Record<string, string> = {};
  const toFetch: string[] = [];

  const cache = loadCache();
  for (const t of unique) {
    if (cache[t]) result[t] = cache[t];
    else toFetch.push(t);
  }

  if (toFetch.length === 0) return result;

  const CONCURRENCY = 8;
  for (let i = 0; i < toFetch.length; i += CONCURRENCY) {
    const chunk = toFetch.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      chunk.map(async text => {
        const url =
          `https://api.mymemory.translated.net/get` +
          `?q=${encodeURIComponent(text.slice(0, 400))}` +
          `&langpair=en|ar`;
        const r = await fetch(url);
        const j: { responseStatus: number; responseData?: { translatedText: string } } = await r.json();
        const tr = j?.responseData?.translatedText;
        return { orig: text, tr: j.responseStatus === 200 && tr ? tr : text };
      })
    );

    const newEntries: Record<string, string> = {};
    for (const s of settled) {
      if (s.status === 'fulfilled') {
        result[s.value.orig] = s.value.tr;
        newEntries[s.value.orig] = s.value.tr;
      }
    }
    saveCache(newEntries);
  }

  return result;
}
