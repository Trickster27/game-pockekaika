import { create } from 'zustand';
import ru from './ru.json';
import en from './en.json';

/**
 * Простой i18n без внешних библиотек. Ключи — пути в JSON через точку: t('camp.level', { level: 3 }).
 * Чтобы добавить язык: положите en.json / uk.json с той же структурой и добавьте его в DICTS.
 * Отсутствующий ключ берётся из русского словаря, а если нет и там — показывается сам ключ.
 */
export type Dict = typeof ru;
type Tree = { [k: string]: string | Tree };

export const LOCALES = [
  { id: 'ru', label: 'Русский', ready: true },
  { id: 'en', label: 'English', ready: true },
  { id: 'uk', label: 'Українська', ready: false },
] as const;
export type LocaleId = (typeof LOCALES)[number]['id'];

const DICTS: Partial<Record<LocaleId, Tree>> = { ru: ru as Tree, en: en as Tree };

function lookup(tree: Tree | undefined, key: string): string | undefined {
  let cur: string | Tree | undefined = tree;
  for (const part of key.split('.')) {
    if (cur === undefined || typeof cur === 'string') return undefined;
    cur = cur[part];
  }
  return typeof cur === 'string' ? cur : undefined;
}

export function translate(locale: LocaleId, key: string, params?: Record<string, string | number>): string {
  const raw = lookup(DICTS[locale], key) ?? lookup(DICTS.ru, key) ?? key;
  return params ? raw.replace(/\{(\w+)\}/g, (_, p: string) => String(params[p] ?? `{${p}}`)) : raw;
}

interface I18nState {
  locale: LocaleId;
  setLocale: (l: LocaleId) => void;
}
export const useI18n = create<I18nState>((set) => ({
  locale: 'ru',
  setLocale: (locale) => set({ locale: DICTS[locale] ? locale : 'ru' }),
}));

/** Хук для компонентов: возвращает t(), привязанный к текущему языку. */
export function useT() {
  const locale = useI18n((s) => s.locale);
  return (key: string, params?: Record<string, string | number>) => translate(locale, key, params);
}

/** Локаль для дат и чисел (Intl). */
export const intlLocale = () => (useI18n.getState().locale === 'en' ? 'en-GB' : 'ru-RU');

export const formatNumber = (n: number) =>
  Math.floor(n)
    .toLocaleString(useI18n.getState().locale === 'en' ? 'en-US' : 'ru-RU')
    .replace(/\s/g, '\u2009');

/** Перевод вне React-компонентов (действия, сервисы). */
export function tr(key: string, params?: Record<string, string | number>): string {
  return translate(useI18n.getState().locale, key, params);
}
