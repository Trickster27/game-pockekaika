import type { ShopReward } from '@/game';
import { formatNumber } from '@/i18n';
import type { MaterialId } from '@/save/schema';
import { IconEnergy, IconGold, IconShard } from './icons';
import { MaterialIcon } from './MaterialIcon';
import '../screens/events.css';

/** Короткая запись награды иконками. */
export function RewardChips({ r }: { r: ShopReward }) {
  return (
    <span className="ev-rw">
      {r.gold ? (
        <i>
          <IconGold /> {formatNumber(r.gold)}
        </i>
      ) : null}
      {r.shards ? (
        <i>
          <IconShard /> {r.shards}
        </i>
      ) : null}
      {r.energy ? (
        <i>
          <IconEnergy /> {r.energy}
        </i>
      ) : null}
      {Object.entries(r.materials ?? {}).map(([m, n]) => (
        <i key={m}>
          <MaterialIcon id={m as MaterialId} /> {n}
        </i>
      ))}
    </span>
  );
}
