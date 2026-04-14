export type SavedAnswer = {
  id: string;
  ownerId: string;
  question: string;
  answer: string;
  createdAt: string;
  confidence?: number;
  citations?: Array<{
    source_id: string;
    page: number;
    source_name: string;
  }>;
};

const SAVED_KEY = "shahem.saved.answers";

function loadAll(): SavedAnswer[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(SAVED_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SavedAnswer[];
  } catch {
    return [];
  }
}

function saveAll(items: SavedAnswer[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SAVED_KEY, JSON.stringify(items));
}

export function listSavedAnswers(ownerId: string): SavedAnswer[] {
  return loadAll()
    .filter((item) => item.ownerId === ownerId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function isAnswerSaved(ownerId: string, id: string): boolean {
  return loadAll().some((item) => item.ownerId === ownerId && item.id === id);
}

export function toggleSavedAnswer(ownerId: string, payload: Omit<SavedAnswer, "ownerId" | "createdAt">): boolean {
  const all = loadAll();
  const existingIndex = all.findIndex((item) => item.ownerId === ownerId && item.id === payload.id);
  if (existingIndex >= 0) {
    all.splice(existingIndex, 1);
    saveAll(all);
    return false;
  }

  all.push({
    ...payload,
    ownerId,
    createdAt: new Date().toISOString(),
  });
  saveAll(all);
  return true;
}

export function removeSavedAnswer(ownerId: string, id: string): void {
  const next = loadAll().filter((item) => !(item.ownerId === ownerId && item.id === id));
  saveAll(next);
}
