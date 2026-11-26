import type { RewardLine } from '@/state/store';
import { IconEnergy, IconGold, IconShard } from './icons';
import { ClanCoinArt, GearArt, MaterialArt, XpArt } from './ItemArt';

export function RewardIcon({ icon, mat }: { icon: RewardLine['icon']; mat?: RewardLine['mat'] }) {
  if (mat) return <MaterialArt id={mat} />;
  switch (icon) {
    case 'gold':
      return <IconGold />;
    case 'shards':
      return <IconShard />;
    case 'energy':
      return <IconEnergy />;
    case 'xp':
      return <XpArt />;
    case 'level':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3 L20 13 L15 13 L15 21 L9 21 L9 13 L4 13 Z"
            fill="#5fcf6f"
            stroke="#0a0710"
            strokeWidth="1.5"
          />
        </svg>
      );
    case 'coin':
      return <ClanCoinArt />;
    case 'item':
      return <GearArt slot="weapon" rarity="rare" gem="#7fe7ff" />;
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 2 L14.6 9 L22 9 L16 13.5 L18.3 21 L12 16.5 L5.7 21 L8 13.5 L2 9 L9.4 9 Z"
            fill="#f0c860"
            stroke="#0a0710"
            strokeWidth="1.5"
          />
        </svg>
      );
  }
}
