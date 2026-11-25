import type { SkillDef } from '@/core/content';

/** Иконка навыка по его визуальному типу и цвету стихии. */
export function SkillIcon({ skill, color }: { skill: SkillDef; color: string }) {
  const fx = skill.fx ?? 'slash';
  const s = { stroke: '#0f0a14', strokeWidth: 1.4 };
  switch (fx) {
    case 'arrow':
    case 'volley':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 21 L18 6" stroke="#b07d3e" strokeWidth="2.5" />
          <path d="M21 3 L13 6 L18 11 Z" fill={color} {...s} />
        </svg>
      );
    case 'ray':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="6" fill={color} {...s} />
          <circle cx="12" cy="12" r="10" fill="none" stroke={color} strokeWidth="1.4" opacity=".6" />
        </svg>
      );
    case 'heal':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="10" fill="none" stroke="#8bff9a" strokeWidth="1.5" opacity=".6" />
          <path d="M12 5 L12 19 M5 12 L19 12" stroke="#8bff9a" strokeWidth="4" />
        </svg>
      );
    case 'shield':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 4 L20 4 L20 11 Q12 24 4 11 Z" fill="#7fe7ff" {...s} />
        </svg>
      );
    case 'buff':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3 L20 13 L15 13 L15 21 L9 21 L9 13 L4 13 Z" fill={color} {...s} />
        </svg>
      );
    case 'debuff':
    case 'poison':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3 Q19 12 17 16 A5.5 5.5 0 0 1 7 16 Q5 12 12 3 Z"
            fill={fx === 'poison' ? '#8be37a' : '#a37cff'}
            {...s}
          />
        </svg>
      );
    case 'fire':
    case 'meteor':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 2 Q20 10 17 17 Q15 22 12 22 Q7 22 6 16 Q5 11 10 7 Q10 12 13 13 Q14 8 12 2 Z"
            fill="#ff7a2a"
            {...s}
          />
        </svg>
      );
    case 'pillars':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="5" fill="#fff0b8" {...s} />
          <path
            d="M12 1 L12 5 M12 19 L12 23 M1 12 L5 12 M19 12 L23 12 M4 4 L7 7 M17 17 L20 20 M4 20 L7 17 M17 7 L20 4"
            stroke="#f0c860"
            strokeWidth="2"
          />
        </svg>
      );
    case 'roots':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 22 Q10 14 4 10 M12 22 Q14 12 20 8 M12 22 L12 4"
            stroke={color}
            strokeWidth="2.4"
            fill="none"
          />
        </svg>
      );
    case 'wave':
    case 'shockwave':
    case 'tide':
    case 'quake':
    case 'storm':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2 14 Q6 8 10 14 T18 14 T24 14" stroke={color} strokeWidth="2.6" fill="none" />
          <path d="M2 19 Q6 13 10 19 T18 19" stroke={color} strokeWidth="1.6" fill="none" opacity=".6" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 19 L17 7 L19 3 L15 5 L3 17 Z" fill="#e6ebf3" {...s} />
          <path d="M3 15 L9 21" stroke={color} strokeWidth="2.5" />
        </svg>
      );
  }
}
