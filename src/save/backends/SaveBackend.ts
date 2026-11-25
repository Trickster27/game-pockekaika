/**
 * Куда физически пишется сейв. Сейчас есть только локальный бэкенд.
 * Облачный бэкенд реализует тот же интерфейс, а SaveManager решит конфликт по updatedAt.
 */
export interface SaveBackend {
  readonly id: string;
  read(): Promise<string | null>;
  write(json: string): Promise<void>;
  /** Предыдущая удачная запись: из неё восстанавливаемся, если основная повреждена. */
  readBackup(): Promise<string | null>;
  clear(): Promise<void>;
}
