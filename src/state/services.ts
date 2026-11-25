import type { Platform } from '@/platform';
import type { SaveManager } from '@/save';

/**
 * Долгоживущие сервисы. Хранятся вне React-состояния: они не меняются после запуска,
 * а компонентам нужны только через хуки стора.
 */
export const services: { platform: Platform | null; saves: SaveManager | null } = {
  platform: null,
  saves: null,
};

export function platform(): Platform {
  if (!services.platform) throw new Error('Платформа ещё не инициализирована');
  return services.platform;
}

export function saves(): SaveManager {
  if (!services.saves) throw new Error('Сохранения ещё не инициализированы');
  return services.saves;
}
