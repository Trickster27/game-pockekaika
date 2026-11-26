import type { SaveData } from '@/save/schema';

/**
 * Занятые герои: на тренировке или в экспедиции. Такие герои не идут в бой,
 * не годятся в жертву для звёзд и слияния и не могут отправиться куда-то ещё.
 */
export type BusyKind = 'training' | 'expedition';

export function busyKind(
  save: Pick<SaveData, 'training'> & { expeditions?: SaveData['expeditions'] },
  uid: string,
): BusyKind | null {
  if (save.training?.slots.some((s) => s.heroUid === uid)) return 'training';
  if (save.expeditions?.board.some((m) => !m.done && m.party?.includes(uid))) return 'expedition';
  return null;
}

export function busyUids(
  save: Pick<SaveData, 'training'> & { expeditions?: SaveData['expeditions'] },
): Set<string> {
  const out = new Set<string>();
  for (const s of save.training?.slots ?? []) out.add(s.heroUid);
  for (const m of save.expeditions?.board ?? []) if (!m.done) for (const u of m.party ?? []) out.add(u);
  return out;
}

export function isBusy(save: Parameters<typeof busyUids>[0], uid: string): boolean {
  return busyKind(save, uid) !== null;
}
