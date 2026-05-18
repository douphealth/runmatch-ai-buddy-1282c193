/**
 * Quiz progress persistence — lets a runner resume the 9-step quiz exactly
 * where they left off, even after a tab close.
 *
 * Stored in localStorage under a single versioned key. Auto-expires after
 * 7 days so stale answers don't bias a returning user.
 */

import type { QuizAnswers } from './quiz-data';

const STORAGE_KEY = 'runmatch.progress.v1';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface QuizProgress {
  answers: QuizAnswers;
  step: number;       // current step index, 0..8
  savedAt: number;
}

const isBrowser = () => typeof window !== 'undefined' && !!window.localStorage;

export function saveProgress(p: Omit<QuizProgress, 'savedAt'>): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...p, savedAt: Date.now() })
    );
  } catch {
    /* quota / private mode — silently ignore */
  }
}

export function loadProgress(): QuizProgress | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuizProgress;
    if (!parsed || typeof parsed.step !== 'number' || !parsed.answers) return null;
    if (Date.now() - parsed.savedAt > TTL_MS) {
      clearProgress();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearProgress(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function hasProgress(): boolean {
  return loadProgress() !== null;
}
