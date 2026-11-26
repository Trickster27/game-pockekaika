/** Иконки нижней навигации: двухцветные, активная вкладка подсвечивается цветом и свечением. */
const k = {
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinejoin: 'round' as const,
  strokeLinecap: 'round' as const,
};

export const NavCamp = () => (
  <svg viewBox="0 0 28 28" aria-hidden="true">
    <path d="M3 23 L14 5 L25 23 Z" fill="currentColor" fillOpacity=".18" {...k} />
    <path d="M11 23 L14 16 L17 23" fill="currentColor" fillOpacity=".5" {...k} />
    <path d="M14 5 L14 2 L18 3.4 L14 4.6" fill="var(--nav-accent)" {...k} strokeWidth={1.3} />
    <path d="M6 25 Q9 21 11 25 M17 25 Q19 21 22 25" fill="none" {...k} stroke="var(--nav-accent)" />
  </svg>
);
export const NavHeroes = () => (
  <svg viewBox="0 0 28 28" aria-hidden="true">
    <path
      d="M6 9 L14 4 L22 9 L22 15 Q22 22 14 25 Q6 22 6 15 Z"
      fill="currentColor"
      fillOpacity=".18"
      {...k}
    />
    <circle cx="14" cy="12" r="3.4" fill="var(--nav-accent)" {...k} strokeWidth={1.4} />
    <path d="M8.5 20.5 Q9.5 16.5 14 16.5 Q18.5 16.5 19.5 20.5" fill="none" {...k} />
  </svg>
);
export const NavTeam = () => (
  <svg viewBox="0 0 28 28" aria-hidden="true">
    <path d="M5 23 L19 9 L21 4 L16 6 L3 20 Z" fill="currentColor" fillOpacity=".2" {...k} />
    <path d="M23 23 L9 9 L7 4 L12 6 L25 20 Z" fill="currentColor" fillOpacity=".2" {...k} />
    <path d="M4 18 L9 23 M24 18 L19 23" {...k} stroke="var(--nav-accent)" strokeWidth={2.4} />
  </svg>
);
export const NavSummon = () => (
  <svg viewBox="0 0 28 28" aria-hidden="true">
    <circle cx="14" cy="14" r="11" fill="none" {...k} strokeDasharray="3 3" strokeOpacity=".6" />
    <path d="M14 3 L7 14 L14 25 L21 14 Z" fill="currentColor" fillOpacity=".2" {...k} />
    <path d="M14 3 L10 14 L14 25" fill="var(--nav-accent)" fillOpacity=".7" {...k} strokeWidth={1.2} />
  </svg>
);
export const NavBag = () => (
  <svg viewBox="0 0 28 28" aria-hidden="true">
    <path
      d="M6 10 Q6 8 8 8 L20 8 Q22 8 22 10 L23 22 Q23 25 20 25 L8 25 Q5 25 5 22 Z"
      fill="currentColor"
      fillOpacity=".18"
      {...k}
    />
    <path d="M10 8 Q10 3 14 3 Q18 3 18 8" fill="none" {...k} />
    <path d="M5.5 14 L22.5 14" {...k} />
    <rect x="11.5" y="12" width="5" height="5" rx="1" fill="var(--nav-accent)" {...k} strokeWidth={1.3} />
  </svg>
);
