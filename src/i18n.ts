/** Source-language keys keep English available and let new UI text fall back safely. */
import { useSyncExternalStore } from 'react';
import { ru } from './locales/ru';

export type Locale = 'en' | 'ru';
const STORAGE_KEY = 'openfield.language';
export function initialLocale(storage?: Pick<Storage, 'getItem'>, languages: readonly string[] = []): Locale {
  try {
    const saved = storage?.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'ru') return saved;
  } catch { /* Storage may be disabled. */ }
  return languages.some((language) => /^ru(?:-|$)/i.test(language)) ? 'ru' : 'en';
}
let locale: Locale = typeof window === 'undefined' ? 'en' : (() => {
  try { return initialLocale(window.localStorage, navigator.languages); }
  catch { return initialLocale(undefined, navigator.languages); }
})();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const useLocale = () => useSyncExternalStore(subscribe, () => locale, () => 'en' as Locale);
export function setLocale(next: Locale) {
  locale = next;
  try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* In-memory choice still works. */ }
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  listeners.forEach((listener) => listener());
}
export function translate(message: string, language: Locale, values: Record<string, unknown> = {}): string {
  const template = language === 'ru' && Object.hasOwn(ru, message) ? ru[message] : message;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => Object.hasOwn(values, key) ? String(values[key]) : match);
}
export function tr(message: string, values?: Record<string, unknown>): string;
export function tr(message: string | undefined, values?: Record<string, unknown>): string | undefined;
export function tr(message: string | null, values?: Record<string, unknown>): string | null;
export function tr(message: string | null | undefined, values?: Record<string, unknown>) {
  return message == null ? message : translate(message, locale, values);
}
if (typeof document !== 'undefined') document.documentElement.lang = locale;
if (typeof window !== 'undefined') window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return;
  locale = initialLocale({ getItem: () => event.newValue }, navigator.languages);
  document.documentElement.lang = locale;
  listeners.forEach((listener) => listener());
});
