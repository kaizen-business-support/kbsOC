import { useEffect, useRef } from 'react';

const PREFIX = 'form_draft_';

/** Sauvegarde les données du formulaire dans localStorage. */
export function saveFormDraft(key: string, data: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(data));
  } catch { /* Quota dépassé — on ignore silencieusement */ }
}

/** Charge un brouillon sauvegardé. Retourne null si aucun brouillon. */
export function loadFormDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Supprime le brouillon (après soumission réussie). */
export function clearFormDraft(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {}
}

/** Indique si un brouillon existe pour cette clé. */
export function hasSavedDraft(key: string): boolean {
  try {
    return localStorage.getItem(PREFIX + key) !== null;
  } catch {
    return false;
  }
}

/**
 * Hook qui auto-sauvegarde `data` dans localStorage avec debounce.
 * - Ignore le premier rendu pour ne pas écraser un brouillon existant.
 * - À utiliser en complément de loadFormDraft() au montage.
 */
export function useFormDraft(key: string, data: unknown, debounceMs = 800): void {
  const timerRef   = useRef<ReturnType<typeof setTimeout>>();
  const isFirstRef = useRef(true);

  useEffect(() => {
    if (isFirstRef.current) {
      isFirstRef.current = false;
      return;
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => saveFormDraft(key, data), debounceMs);
    return () => clearTimeout(timerRef.current);
  });
}
