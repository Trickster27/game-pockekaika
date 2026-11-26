import { useMemo } from 'react';
import { CLAN, computeBadges } from '@/game';
import type { ClanState } from '@/online';
import { useGame } from '@/state/store';
import { useClan } from '@/state/clan';
import { useNow } from './hooks';

/** Есть ли в клане что-то, что ждёт игрока сегодня. */
export function clanBadge(c: ClanState | null): boolean {
  return (
    !!c &&
    (!c.me.today.checkin ||
      c.me.today.keys < CLAN.keysPerDay ||
      c.pendingKills.length > 0 ||
      !!c.yesterday ||
      (c.me.role !== 'member' && c.requests.length > 0))
  );
}

/** Красные точки для меню и карты лагеря. */
export function useBadges() {
  const save = useGame((s) => s.save);
  const clan = useClan((s) => s.state);
  const now = useNow(30_000);
  return useMemo(() => {
    if (!save) return null;
    const b = computeBadges(save, now);
    const c = clanBadge(clan);
    return { ...b, clan: c, camp: b.quests || b.arena || b.idle || b.campUp || b.training || c };
  }, [save, clan, now]);
}
