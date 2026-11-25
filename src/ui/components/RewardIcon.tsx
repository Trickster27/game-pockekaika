import type { RewardLine } from '@/state/store';
import { IconEnergy, IconGold, IconShard } from './icons';

export function RewardIcon({ icon }: { icon: RewardLine['icon'] }) {
  switch (icon) {
    case 'gold':
      return <IconGold />;
    case 'shards':
      return <IconShard />;
    case 'energy':
      return <IconEnergy />;
    case 'xp':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3 L20 8 L20 16 L12 21 L4 16 L4 8 Z"
            fill="#6fb3ff"
            stroke="#0a0710"
            strokeWidth="1.6"
          />
          <path d="M8 13 L11 16 L16 9" stroke="#fff" strokeWidth="2" fill="none" />
        </svg>
      );
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
    case 'item':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 19 L17 7 L19 3 L15 5 L3 17 Z" fill="#e6ebf3" stroke="#0a0710" strokeWidth="1.5" />
        </svg>
      );
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
