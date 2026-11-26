import { EnergyArt, GoldArt, ShardArt } from './ItemArt';
/** Иконки интерфейса. Цвет берут из currentColor, где это уместно. */
const s = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinejoin: 'round' as const,
  strokeLinecap: 'round' as const,
};

export const IconCamp = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 20 L12 4 L21 20 Z" {...s} fill="currentColor" fillOpacity=".2" />
    <path d="M10 20 L12 15 L14 20" {...s} />
  </svg>
);
export const IconHeroes = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="8" r="4" {...s} />
    <path d="M4 21 Q4 13 12 13 Q20 13 20 21" {...s} />
  </svg>
);
export const IconTeam = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 19 L17 7 L19 3 L15 5 L3 17 Z" {...s} />
    <path d="M19 19 L7 7 L5 3 L9 5 L21 17 Z" {...s} />
  </svg>
);
export const IconSummon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2 L5 12 L12 22 L19 12 Z" {...s} />
    <path d="M5 12 L19 12" {...s} strokeWidth={1.3} />
  </svg>
);
export const IconBag = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="4" y="7" width="16" height="13" rx="2" {...s} />
    <path d="M9 7 L9 4 L15 4 L15 7" {...s} />
  </svg>
);
export const IconGear = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="3.4" {...s} />
    <path
      d="M12 2 L12 5 M12 19 L12 22 M2 12 L5 12 M19 12 L22 12 M4.9 4.9 L7 7 M17 17 L19.1 19.1 M4.9 19.1 L7 17 M17 7 L19.1 4.9"
      {...s}
    />
  </svg>
);
export const IconBack = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M15 4 L7 12 L15 20" {...s} strokeWidth={2.2} />
  </svg>
);
export const IconGold = () => <GoldArt />;
export const IconShard = () => <ShardArt />;
export const IconEnergy = () => <EnergyArt />;
export const IconCrystal = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="24" fill="#f0c860" opacity=".15" />
    <path
      d="M32 6 L18 30 L32 58 L46 30 Z"
      fill="#f0c860"
      stroke="#0a0710"
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <path d="M32 6 L18 30 L32 30 Z" fill="#fff0b8" />
    <path d="M32 58 L46 30 L32 30 Z" fill="#c98a2a" />
  </svg>
);
