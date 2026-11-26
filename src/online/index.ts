import type { OnlineBackend } from './types';
import { DemoOnlineBackend } from './demo';

export * from './types';
export * from './clanTypes';
export * from './socialTypes';
export { decideSync, type SyncAction } from './sync';

/**
 * Выбор бэкенда: если в окружении сборки есть ключи Supabase — настоящий сервер,
 * иначе демо-режим внутри браузера (без сети, с ботами).
 */
export async function createOnlineBackend(): Promise<OnlineBackend> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (url && key) {
    const { SupabaseOnlineBackend } = await import('./supabase');
    return new SupabaseOnlineBackend(url, key);
  }
  return new DemoOnlineBackend();
}
