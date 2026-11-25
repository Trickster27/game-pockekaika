/**
 * Решение о синхронизации сейва. lastSyncedAt — updatedAt сейва при последней удачной синхронизации
 * на этом устройстве. Если с тех пор менялись обе копии — это конфликт, выбор за игроком.
 */
export type SyncAction = 'none' | 'push' | 'pull' | 'conflict';

export function decideSync(
  localUpdatedAt: number,
  remoteUpdatedAt: number | null,
  lastSyncedAt: number,
): SyncAction {
  if (remoteUpdatedAt === null) return 'push';
  if (localUpdatedAt === remoteUpdatedAt) return 'none';
  const localChanged = localUpdatedAt > lastSyncedAt;
  const remoteChanged = remoteUpdatedAt > lastSyncedAt;
  if (localChanged && !remoteChanged) return 'push';
  if (!localChanged && remoteChanged) return 'pull';
  if (!localChanged && !remoteChanged) return localUpdatedAt > remoteUpdatedAt ? 'push' : 'pull';
  return 'conflict';
}
