/** Герб клана: щит в цвете клана и символ. */
const GLYPHS: Record<string, string> = {
  shield: 'M24 13 L33 17 L32 27 Q29 34 24 37 Q19 34 16 27 L15 17 Z',
  sword: 'M24 10 L27 14 L26 28 L30 28 L30 31 L26 31 L26 37 L22 37 L22 31 L18 31 L18 28 L22 28 L21 14 Z',
  crown: 'M13 32 L15 17 L20 24 L24 14 L28 24 L33 17 L35 32 Z',
  flame: 'M24 10 Q32 19 31 27 Q30 36 24 37 Q17 36 17 28 Q17 22 21 18 Q21 24 24 25 Q26 19 24 10 Z',
  leaf: 'M14 34 Q14 14 34 12 Q34 32 14 34 Z M16 32 L30 16',
  wave: 'M12 26 Q16 18 20 26 Q24 34 28 26 Q32 18 36 26 L36 33 Q32 26 28 33 Q24 40 20 33 Q16 26 12 33 Z',
  moon: 'M28 11 Q16 14 16 24 Q16 34 28 37 Q20 31 20 24 Q20 17 28 11 Z',
  sun: 'M24 17 A7 7 0 1 1 23.9 17 Z M24 9 L24 13 M24 35 L24 39 M9 24 L13 24 M35 24 L39 24 M13 13 L16 16 M32 32 L35 35 M35 13 L32 16 M16 32 L13 35',
  skull:
    'M15 23 Q15 12 24 12 Q33 12 33 23 Q33 28 29 30 L29 35 L19 35 L19 30 Q15 28 15 23 Z M19 22 L22 22 L22 25 L19 25 Z M26 22 L29 22 L29 25 L26 25 Z',
  anvil: 'M12 18 L36 18 L36 21 Q30 22 29 26 L32 33 L16 33 L19 26 Q14 24 12 21 Z',
  eye: 'M10 24 Q24 11 38 24 Q24 37 10 24 Z M24 19 A5 5 0 1 1 23.9 19 Z',
  star: 'M24 10 L28 20 L38 20 L30 27 L33 37 L24 31 L15 37 L18 27 L10 20 L20 20 Z',
};

export function ClanEmblem({ emblem, color, size = 44 }: { emblem: string; color: string; size?: number }) {
  const g = GLYPHS[emblem] ?? GLYPHS.shield!;
  const stroked = emblem === 'leaf' || emblem === 'sun';
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="clan-emblem">
      <path
        d="M24 2 L44 8 L42 28 Q38 40 24 46 Q10 40 6 28 L4 8 Z"
        fill={`color-mix(in srgb, ${color} 30%, #17121f)`}
        stroke="#0a0710"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M24 5 L41 10 L39 28 Q35 38 24 43 Q13 38 9 28 L7 10 Z"
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d={g}
        fill={stroked ? color : color}
        fillRule="evenodd"
        stroke={stroked ? color : '#0a0710'}
        strokeWidth={stroked ? 2.4 : 1.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
