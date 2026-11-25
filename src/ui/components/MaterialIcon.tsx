import type { MaterialId } from '@/save/schema';

export function MaterialIcon({ id }: { id: MaterialId }) {
  const s = { stroke: '#0a0710', strokeWidth: 1.5, strokeLinejoin: 'round' as const };
  switch (id) {
    case 'xpTome':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 4 L14 4 Q20 4 20 8 L20 20 L8 20 Q4 20 4 16 Z" fill="#2c3f7a" {...s} />
          <path d="M8 8 L16 8 M8 12 L14 12" stroke="#a8d4ff" strokeWidth="1.6" />
          <circle cx="15" cy="16" r="2.5" fill="#6fb3ff" {...s} strokeWidth={1} />
        </svg>
      );
    case 'starDust':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="14" r="7" fill="#3a2a5c" {...s} />
          <path
            d="M12 3 L13.5 7 L18 7 L14.5 9.5 L16 14 L12 11 L8 14 L9.5 9.5 L6 7 L10.5 7 Z"
            fill="#f0c860"
            {...s}
            strokeWidth={1.2}
          />
          <circle cx="8" cy="17" r="1.2" fill="#ffe7a0" />
          <circle cx="15" cy="18" r="1" fill="#ffe7a0" />
        </svg>
      );
    case 'awakenStone':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2 L5 10 L12 22 L19 10 Z" fill="#7fe7ff" {...s} />
          <path d="M12 2 L5 10 L12 10 Z" fill="#d8fbff" />
          <path d="M12 22 L19 10 L12 10 Z" fill="#3fbfd0" />
        </svg>
      );
    case 'scroll':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 4 L17 4 Q20 4 20 7 L20 20 L8 20 Q5 20 5 17 Z" fill="#efe6cf" {...s} />
          <circle cx="14" cy="13" r="3" fill="#a37cff" {...s} strokeWidth={1.2} />
          <path d="M8 8 L15 8" stroke="#8a7a5e" strokeWidth="1.4" />
        </svg>
      );
  }
}
