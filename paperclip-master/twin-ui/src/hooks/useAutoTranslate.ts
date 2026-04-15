import { useState, useEffect, useRef } from 'react';
import { getCachedAr, translateToArabic } from '../utils/translate';

/**
 * Given an array of English strings and a boolean `isAr`,
 * returns a `tx(text)` function that returns the Arabic translation
 * when Arabic mode is on, or the original text otherwise.
 *
 * - On first render: returns cached translations from localStorage instantly.
 * - Then fetches any uncached strings from MyMemory API in the background.
 * - Translations are persisted so subsequent renders are instant.
 */
export function useAutoTranslate(texts: string[], isAr: boolean) {
  const [dict, setDict] = useState<Record<string, string>>(() => {
    if (!isAr) return {};
    const r: Record<string, string> = {};
    for (const t of texts) {
      const cached = getCachedAr(t);
      if (cached) r[t] = cached;
    }
    return r;
  });

  const prevKey = useRef('');

  useEffect(() => {
    if (!isAr) return;
    const k = texts.filter(Boolean).sort().join('\0');
    if (!k || k === prevKey.current) return;
    prevKey.current = k;

    translateToArabic(texts).then(result =>
      setDict(prev => ({ ...prev, ...result }))
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texts.filter(Boolean).join('\0'), isAr]);

  // When switching back to English, clear dict so re-enabling AR re-runs
  useEffect(() => {
    if (!isAr) setDict({});
  }, [isAr]);

  return (text: string): string =>
    isAr ? (dict[text] ?? text) : text;
}
