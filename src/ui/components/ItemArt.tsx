/**
 * Проработанные иконки предметов, материалов и валют (в стиле «Тёмный витраж»):
 * объём градиентами, блики, свечение, жирный тёмный контур. Каждый предмет узнаётся по силуэту.
 *
 * Градиенты внутри SVG названы одинаково у одинаковых иконок — повтор id на странице безвреден,
 * потому что определения совпадают.
 */
import type { ReactNode } from 'react';
import type { MaterialId } from '@/save/schema';

const L = '#0d0912';
const sk = { stroke: L, strokeWidth: 2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

function Svg({ children, defs }: { children: ReactNode; defs?: ReactNode }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="iart">
      {defs && <defs>{defs}</defs>}
      {children}
    </svg>
  );
}
const lin = (id: string, a: string, b: string, x2 = 0, y2 = 1) => (
  <linearGradient id={id} x1="0" y1="0" x2={x2} y2={y2}>
    <stop offset="0" stopColor={a} />
    <stop offset="1" stopColor={b} />
  </linearGradient>
);
const rad = (id: string, a: string, b: string) => (
  <radialGradient id={id}>
    <stop offset="0" stopColor={a} />
    <stop offset="1" stopColor={b} stopOpacity="0" />
  </radialGradient>
);
const Sparkle = ({ x, y, r = 2.4, c = '#fff8dc' }: { x: number; y: number; r?: number; c?: string }) => (
  <path
    d={`M${x} ${y - r * 2} Q${x + r * 0.3} ${y - r * 0.3} ${x + r * 2} ${y} Q${x + r * 0.3} ${y + r * 0.3} ${x} ${y + r * 2} Q${x - r * 0.3} ${y + r * 0.3} ${x - r * 2} ${y} Q${x - r * 0.3} ${y - r * 0.3} ${x} ${y - r * 2} Z`}
    fill={c}
  />
);

/** Свиток: свёрнутый пергамент с валиками, лентой и эмблемой. */
function ScrollArt(p: {
  id: string;
  paper: [string, string];
  rod: string;
  rodEnd: string;
  ribbon: string;
  glow: string;
  emblem: ReactNode;
  aura?: boolean;
}) {
  return (
    <Svg
      defs={
        <>
          {lin(`${p.id}-p`, p.paper[0], p.paper[1])}
          {lin(`${p.id}-r`, p.rodEnd, p.rod, 1, 0)}
          {rad(`${p.id}-g`, p.glow, p.glow)}
        </>
      }
    >
      {p.aura && <circle cx="24" cy="24" r="22" fill={`url(#${p.id}-g)`} opacity=".55" />}
      <path d="M10 10 L38 10 L38 38 L10 38 Z" fill={`url(#${p.id}-p)`} {...sk} />
      <path d="M13 14 L35 14 M13 33 L35 33" stroke={p.paper[1]} strokeWidth="1.4" opacity=".8" />
      <rect x="6" y="6" width="36" height="6" rx="3" fill={`url(#${p.id}-r)`} {...sk} />
      <rect x="6" y="36" width="36" height="6" rx="3" fill={`url(#${p.id}-r)`} {...sk} />
      <circle cx="6" cy="9" r="3" fill={p.rodEnd} {...sk} strokeWidth={1.6} />
      <circle cx="42" cy="9" r="3" fill={p.rodEnd} {...sk} strokeWidth={1.6} />
      <circle cx="6" cy="39" r="3" fill={p.rodEnd} {...sk} strokeWidth={1.6} />
      <circle cx="42" cy="39" r="3" fill={p.rodEnd} {...sk} strokeWidth={1.6} />
      <path d="M30 38 L28 46 L32 43 L36 46 L34 38 Z" fill={p.ribbon} {...sk} strokeWidth={1.6} />
      {p.emblem}
    </Svg>
  );
}

export function MaterialArt({ id }: { id: MaterialId }) {
  switch (id) {
    case 'xpTome':
      return (
        <Svg
          defs={
            <>
              {lin('xt-c', '#4a6ad8', '#1c2a6a', 1, 1)}
              {rad('xt-g', '#bfe0ff', '#6fb3ff')}
            </>
          }
        >
          <path d="M12 8 L36 6 L38 38 L14 42 Z" fill="#efe6cf" {...sk} />
          <path d="M14 42 L38 38 L38 41 L15 45 Z" fill="#d8c8a0" {...sk} strokeWidth={1.6} />
          <path d="M8 9 L34 6 Q37 6 37 9 L37 36 L11 40 Q8 40 8 37 Z" fill="url(#xt-c)" {...sk} />
          <path d="M8 9 L13 8.4 L13 39.4 L11 40 Q8 40 8 37 Z" fill="#14205a" opacity=".7" />
          <circle cx="24" cy="22" r="10" fill="url(#xt-g)" opacity=".7" />
          <circle cx="24" cy="22" r="6.5" fill="none" stroke="#bfe0ff" strokeWidth="1.6" />
          <path
            d="M24 15 L26 20 L31 22 L26 24 L24 29 L22 24 L17 22 L22 20 Z"
            fill="#e8f4ff"
            stroke="#2c3f7a"
            strokeWidth="1"
          />
          <path
            d="M31 7 L36 7 L36 12 Z M8 33 L8 37 Q8 40 11 40 L13 40 Z"
            fill="#f0c860"
            {...sk}
            strokeWidth={1.4}
          />
          <path d="M11 12 L33 9.5" stroke="#8fb0ff" strokeWidth="1.2" opacity=".7" />
        </Svg>
      );
    case 'starDust':
      return (
        <Svg
          defs={
            <>
              {lin('sd-b', '#8a5ad8', '#3a1f6a', 1, 1)}
              {rad('sd-g', '#fff0b8', '#f0c860')}
            </>
          }
        >
          <circle cx="30" cy="30" r="16" fill="url(#sd-g)" opacity=".45" />
          <path d="M14 18 Q8 26 10 36 Q14 44 24 44 Q34 44 36 36 Q38 26 30 18 Z" fill="url(#sd-b)" {...sk} />
          <path d="M16 18 Q22 14 28 18 L30 14 Q22 10 14 14 Z" fill="#6a3aa8" {...sk} />
          <path d="M14 18 Q22 21 30 18" fill="none" stroke="#f0c860" strokeWidth="2.6" />
          <path d="M14 18 Q22 21 30 18" fill="none" stroke={L} strokeWidth="0.8" opacity=".4" />
          <path d="M13 28 Q14 22 20 20" fill="none" stroke="#c8a8ff" strokeWidth="1.6" opacity=".8" />
          <Sparkle x={34} y={14} r={2.6} />
          <Sparkle x={40} y={26} r={1.8} c="#ffe08a" />
          <Sparkle x={22} y={32} r={2.2} c="#ffe08a" />
          <circle cx="38" cy="36" r="1.4" fill="#fff4c8" />
          <circle cx="28" cy="38" r="1.1" fill="#fff4c8" />
        </Svg>
      );
    case 'awakenStone':
      return (
        <Svg
          defs={
            <>
              {lin('aw-a', '#e8fdff', '#3fbfd0', 1, 1)}
              {rad('aw-g', '#bff7ff', '#4fd6e0')}
            </>
          }
        >
          <circle cx="24" cy="22" r="20" fill="url(#aw-g)" opacity=".5" />
          <path d="M10 38 Q24 32 38 38 L36 44 L12 44 Z" fill="#5a5260" {...sk} />
          <path d="M24 4 L12 18 L18 38 L30 38 L36 18 Z" fill="url(#aw-a)" {...sk} />
          <path d="M24 4 L18 18 L24 38 L30 18 Z" fill="#9ff0ff" opacity=".7" />
          <path d="M12 18 L36 18 M18 18 L24 4 L30 18" fill="none" stroke="#2f8a96" strokeWidth="1.2" />
          <path d="M16 14 L20 10" stroke="#ffffff" strokeWidth="2" />
          <Sparkle x={38} y={10} r={2.2} c="#e8fdff" />
        </Svg>
      );
    case 'ore':
      return (
        <Svg defs={<>{lin('or-a', '#8a8094', '#3a3440', 1, 1)}</>}>
          <path d="M6 34 L10 18 L22 8 L36 12 L44 26 L40 40 L22 44 Z" fill="url(#or-a)" {...sk} />
          <path d="M10 18 L22 8 L24 22 Z" fill="#a8a0b4" opacity=".6" />
          <path d="M22 44 L24 22 L44 26" fill="none" stroke="#2a2430" strokeWidth="1.4" />
          <path
            d="M12 30 L18 26 L22 32 L28 28 M30 18 L34 24 L38 22"
            fill="none"
            stroke="#7fe7ff"
            strokeWidth="2.4"
          />
          <path
            d="M12 30 L18 26 L22 32 L28 28 M30 18 L34 24 L38 22"
            fill="none"
            stroke="#e0fbff"
            strokeWidth="0.8"
          />
          <path d="M26 30 L30 22 L34 30 L30 34 Z" fill="#9ff0ff" {...sk} strokeWidth={1.4} />
        </Svg>
      );
    case 'skillBook':
      return (
        <Svg
          defs={
            <>
              {lin('sb-c', '#b04a8a', '#4a1438', 1, 1)}
              {rad('sb-g', '#ffd0f0', '#ff7ad9')}
            </>
          }
        >
          <path d="M12 8 L38 6 L40 40 L14 42 Z" fill="#efe6cf" {...sk} />
          <path d="M8 9 L34 6 Q37 6 37 9 L37 38 L11 41 Q8 41 8 38 Z" fill="url(#sb-c)" {...sk} />
          <path
            d="M14 12 L31 10 L31 34 L14 36 Z"
            fill="none"
            stroke="#d8c0d0"
            strokeWidth="1.4"
            opacity=".8"
          />
          <circle cx="22.5" cy="22" r="9" fill="url(#sb-g)" opacity=".6" />
          <path
            d="M22.5 14 L25 20 L31 21 L26.5 25 L28 31 L22.5 27.6 L17 31 L18.5 25 L14 21 L20 20 Z"
            fill="#ffe08a"
            {...sk}
            strokeWidth={1.3}
          />
          <path d="M37 16 L42 16 L42 24 L37 24" fill="#c8ccdc" {...sk} strokeWidth={1.6} />
          <path d="M30 38 L30 46 L33 43 L36 46 L36 38" fill="#e0503a" {...sk} strokeWidth={1.4} />
        </Svg>
      );
    case 'scroll':
      return (
        <ScrollArt
          id="ss"
          paper={['#fbf3dc', '#d8c49a']}
          rod="#6b4a2b"
          rodEnd="#a8743a"
          ribbon="#c8343c"
          glow="#a37cff"
          emblem={
            <>
              <circle cx="24" cy="24" r="6.5" fill="#c8343c" stroke={L} strokeWidth="1.8" />
              <path
                d="M24 19.5 L25.5 23 L29 24 L25.5 25 L24 28.5 L22.5 25 L19 24 L22.5 23 Z"
                fill="#ffb0a0"
              />
            </>
          }
        />
      );
    case 'ancientScroll':
      return (
        <ScrollArt
          id="as"
          paper={['#e8eef8', '#9fb0cc']}
          rod="#3a4a6a"
          rodEnd="#7a8ab0"
          ribbon="#5fa8ff"
          glow="#5fa8ff"
          aura
          emblem={
            <>
              <path d="M24 16 L31 24 L24 32 L17 24 Z" fill="#5fa8ff" stroke={L} strokeWidth="1.8" />
              <path d="M24 19 L28 24 L24 29 L20 24 Z" fill="#d8ecff" />
              <path
                d="M14 20 L16 22 M34 20 L32 22 M14 28 L16 26 M34 28 L32 26"
                stroke="#3a5a90"
                strokeWidth="1.4"
              />
            </>
          }
        />
      );
    case 'factionScroll':
      return (
        <ScrollArt
          id="fs"
          paper={['#eef6e4', '#b8d0a0']}
          rod="#4a6a3a"
          rodEnd="#8ab070"
          ribbon="#5fb070"
          glow="#5fb070"
          emblem={
            <>
              <path
                d="M17 16 L31 16 L31 25 Q31 31 24 34 Q17 31 17 25 Z"
                fill="#2c3f7a"
                stroke={L}
                strokeWidth="1.8"
              />
              <path d="M24 16 L24 34 M17 23 L31 23" stroke="#f0c860" strokeWidth="1.6" />
              <circle cx="20" cy="19.5" r="1.6" fill="#e0503a" />
              <circle cx="28" cy="19.5" r="1.6" fill="#5fb070" />
              <circle cx="20" cy="27" r="1.6" fill="#5fbfb2" />
              <circle cx="28" cy="27" r="1.6" fill="#c98a45" />
            </>
          }
        />
      );
    case 'voidScroll':
      return (
        <ScrollArt
          id="vs"
          paper={['#4a3470', '#1c1030']}
          rod="#1a1030"
          rodEnd="#6a4aa8"
          ribbon="#a37cff"
          glow="#a37cff"
          aura
          emblem={
            <>
              <path d="M14 24 Q24 14 34 24 Q24 34 14 24 Z" fill="#efe6ff" stroke={L} strokeWidth="1.8" />
              <circle cx="24" cy="24" r="4.4" fill="#a37cff" stroke={L} strokeWidth="1.2" />
              <circle cx="24" cy="24" r="1.8" fill={L} />
              <path
                d="M15 15 L18 18 M33 15 L30 18 M15 33 L18 30 M33 33 L30 30"
                stroke="#c79cff"
                strokeWidth="1.4"
              />
            </>
          }
        />
      );
    case 'goldScroll':
      return (
        <ScrollArt
          id="gs"
          paper={['#fff6d8', '#e8c060']}
          rod="#a8742a"
          rodEnd="#ffe08a"
          ribbon="#ff5d7a"
          glow="#ffd36b"
          aura
          emblem={
            <>
              {Array.from({ length: 8 }, (_, i) => {
                const a = (i * Math.PI) / 4;
                return (
                  <path
                    key={i}
                    d={`M${24 + Math.cos(a) * 7} ${24 + Math.sin(a) * 7} L${24 + Math.cos(a) * 11} ${24 + Math.sin(a) * 11}`}
                    stroke="#c98f2a"
                    strokeWidth="2"
                  />
                );
              })}
              <circle cx="24" cy="24" r="6" fill="#ffd36b" stroke={L} strokeWidth="1.8" />
              <circle cx="22.5" cy="22.5" r="1.8" fill="#fff8dc" />
              <Sparkle x={36} y={17} r={1.8} />
            </>
          }
        />
      );
  }
}

// ———————————————————— валюты ————————————————————

export function GoldArt() {
  return (
    <Svg defs={<>{lin('gd-a', '#ffe9a0', '#c98f2a', 1, 1)}</>}>
      <ellipse cx="24" cy="34" rx="16" ry="6" fill="#a8742a" stroke={L} strokeWidth="2" />
      <ellipse cx="24" cy="30" rx="16" ry="6" fill="#d9a94a" stroke={L} strokeWidth="2" />
      <circle cx="24" cy="20" r="15" fill="url(#gd-a)" stroke={L} strokeWidth="2.2" />
      <circle cx="24" cy="20" r="10.5" fill="none" stroke="#a8742a" strokeWidth="1.6" />
      <path
        d="M18 23 L19 15 L22 18 L24 13 L26 18 L29 15 L30 23 Z"
        fill="#fff0b8"
        stroke="#a8742a"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M14 14 Q17 8 23 7" fill="none" stroke="#ffffff" strokeWidth="2" opacity=".7" />
    </Svg>
  );
}

export function ShardArt() {
  return (
    <Svg
      defs={
        <>
          {lin('sh-a', '#f0dcff', '#8a4ae0', 1, 1)}
          {rad('sh-g', '#d6b8ff', '#a37cff')}
        </>
      }
    >
      <circle cx="24" cy="24" r="20" fill="url(#sh-g)" opacity=".45" />
      <path d="M12 30 L8 20 L14 16 Z" fill="#b48aff" stroke={L} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M36 32 L42 22 L36 18 Z" fill="#9a6ae8" stroke={L} strokeWidth="1.8" strokeLinejoin="round" />
      <path
        d="M24 3 L13 20 L24 45 L35 20 Z"
        fill="url(#sh-a)"
        stroke={L}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path d="M24 3 L19 20 L24 45 L29 20 Z" fill="#e8d4ff" opacity=".6" />
      <path d="M13 20 L35 20" stroke="#6a3ab8" strokeWidth="1.2" />
      <path d="M18 14 L22 8" stroke="#ffffff" strokeWidth="2" />
    </Svg>
  );
}

export function EnergyArt() {
  return (
    <Svg
      defs={
        <>
          {rad('en-o', '#2a6a9a', '#123050')}
          {lin('en-b', '#ffffff', '#7fe7ff')}
        </>
      }
    >
      <circle cx="24" cy="24" r="19" fill="url(#en-o)" stroke={L} strokeWidth="2" />
      <circle cx="24" cy="24" r="19" fill="none" stroke="#7fe7ff" strokeWidth="1.4" opacity=".6" />
      <path
        d="M27 6 L13 27 L22 27 L19 42 L35 19 L26 19 Z"
        fill="url(#en-b)"
        stroke={L}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M13 12 Q18 7 24 6" fill="none" stroke="#bff7ff" strokeWidth="1.6" opacity=".7" />
    </Svg>
  );
}

export function ClanCoinArt() {
  return (
    <Svg defs={<>{lin('cc-a', '#f0c8a0', '#a8682e', 1, 1)}</>}>
      <circle cx="24" cy="24" r="18" fill="url(#cc-a)" stroke={L} strokeWidth="2.2" />
      <circle cx="24" cy="24" r="13" fill="none" stroke="#7a4a1e" strokeWidth="1.6" />
      <path
        d="M17 16 L31 16 L31 24 Q31 30 24 33 Q17 30 17 24 Z"
        fill="#c8343c"
        stroke={L}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M24 17 L24 32 M18 23 L30 23" stroke="#f0c860" strokeWidth="1.6" />
    </Svg>
  );
}

export function XpArt() {
  return (
    <Svg defs={<>{rad('xp-g', '#bfe0ff', '#6fb3ff')}</>}>
      <circle cx="24" cy="24" r="20" fill="url(#xp-g)" opacity=".4" />
      <path
        d="M24 6 L29 18 L42 19 L32 28 L35 41 L24 34 L13 41 L16 28 L6 19 L19 18 Z"
        fill="#6fb3ff"
        stroke={L}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M24 12 L27 20 L35 21 L29 26" fill="none" stroke="#e8f4ff" strokeWidth="1.6" />
    </Svg>
  );
}

// ———————————————————— снаряжение ————————————————————

/** Металл по редкости: железо → сталь → зачарованный → золото → алая мифриловая. */
const METAL: Record<string, [string, string, string]> = {
  common: ['#d0ccd8', '#7a7484', '#56505e'],
  rare: ['#d8ecff', '#6a8ab8', '#3a5078'],
  epic: ['#ecd8ff', '#8a6ac0', '#4a3478'],
  legendary: ['#fff0b8', '#d9a94a', '#8a5a1a'],
  mythic: ['#ffd8e0', '#e0607a', '#7a1a30'],
};

function GearShape({ slot, m, gem }: { slot: string; m: string; gem: string }) {
  const f = `url(#${m})`;
  switch (slot) {
    case 'weapon':
      return (
        <>
          <path d="M27 7 L41 3 L37 17 L17 37 L11 31 Z" fill={f} {...sk} />
          <path d="M29 9 L38 6 L35 15 L20 30" fill="none" stroke="#ffffff" strokeWidth="1.6" opacity=".7" />
          <path d="M8 26 L22 40 L19 43 L5 29 Z" fill="#c8a050" {...sk} />
          <path d="M11 37 L5 43" stroke={L} strokeWidth="6" strokeLinecap="round" />
          <path d="M11 37 L5 43" stroke="#6b4a2b" strokeWidth="3.4" strokeLinecap="round" />
          <circle cx="13.5" cy="34.5" r="3.2" fill={gem} stroke={L} strokeWidth="1.4" />
        </>
      );
    case 'helmet':
      return (
        <>
          <path d="M8 30 Q6 8 24 6 Q42 8 40 30 L36 40 L12 40 Z" fill={f} {...sk} />
          <path d="M11 22 L37 22 L36 28 L12 28 Z" fill={L} />
          <rect x="14" y="24" width="7" height="2" fill={gem} />
          <rect x="27" y="24" width="7" height="2" fill={gem} />
          <path d="M24 6 L24 21 M24 28 L24 40" stroke={L} strokeWidth="1.6" />
          <path d="M14 14 Q18 9 23 8.5" fill="none" stroke="#ffffff" strokeWidth="1.8" opacity=".7" />
          <circle cx="24" cy="12" r="2.6" fill={gem} stroke={L} strokeWidth="1.2" />
        </>
      );
    case 'armor':
      return (
        <>
          <path d="M6 14 L16 8 Q24 12 32 8 L42 14 L38 22 L36 42 L12 42 L10 22 Z" fill={f} {...sk} />
          <path d="M16 8 Q24 16 32 8" fill="none" stroke={L} strokeWidth="1.8" />
          <path
            d="M14 24 Q24 28 34 24 M14 32 Q24 36 34 32"
            fill="none"
            stroke={L}
            strokeWidth="1.4"
            opacity=".6"
          />
          <path d="M24 16 L24 40" stroke={L} strokeWidth="1.4" opacity=".6" />
          <path d="M11 17 L15 13" stroke="#ffffff" strokeWidth="1.8" opacity=".7" />
          <path d="M24 18 L28 23 L24 28 L20 23 Z" fill={gem} stroke={L} strokeWidth="1.4" />
        </>
      );
    case 'gloves':
      return (
        <>
          <path
            d="M14 44 L14 26 L12 14 Q12 10 16 10 L18 22 L19 8 Q20 5 23 6 L24 21 L26 7 Q28 5 30 7 L29 22 L32 11 Q35 10 35 13 L33 26 L38 22 Q42 22 40 27 L34 36 L32 44 Z"
            fill={f}
            {...sk}
          />
          <path d="M14 34 L33 34 L32 44 L14 44 Z" fill="#6b4a2b" {...sk} />
          <circle cx="23" cy="39" r="2.8" fill={gem} stroke={L} strokeWidth="1.3" />
          <path d="M16 13 L17 21" stroke="#ffffff" strokeWidth="1.4" opacity=".7" />
        </>
      );
    case 'boots':
      return (
        <>
          <path d="M14 4 L30 4 L30 28 L42 32 Q45 34 44 40 L44 44 L10 44 L10 30 Z" fill={f} {...sk} />
          <path d="M10 38 L44 38" stroke={L} strokeWidth="1.8" />
          <path d="M13 4 L31 4 L31 10 L13 10 Z" fill="#6b4a2b" {...sk} />
          <path d="M16 14 L16 26" stroke="#ffffff" strokeWidth="1.8" opacity=".7" />
          <circle cx="22" cy="7" r="2.4" fill={gem} stroke={L} strokeWidth="1.2" />
          <path d="M30 28 L30 38" stroke={L} strokeWidth="1.2" opacity=".5" />
        </>
      );
    default:
      return (
        <>
          <path d="M8 4 Q24 26 40 4" fill="none" stroke={L} strokeWidth="4.4" />
          <path d="M8 4 Q24 26 40 4" fill="none" stroke="#c8a050" strokeWidth="2" />
          <path d="M24 18 L36 30 L24 46 L12 30 Z" fill={f} {...sk} />
          <path d="M24 22 L32 30 L24 41 L16 30 Z" fill={gem} stroke={L} strokeWidth="1.4" />
          <path d="M20 27 L23 24" stroke="#ffffff" strokeWidth="1.8" />
        </>
      );
  }
}

/** Предмет снаряжения: силуэт слота, металл по редкости, камень цвета сета. */
export function GearArt({ slot, rarity, gem }: { slot: string; rarity?: string; gem?: string }) {
  const r = rarity ?? 'common';
  const [a, b, c] = METAL[r] ?? METAL.common!;
  const id = `gm-${r}`;
  return (
    <Svg
      defs={
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset=".55" stopColor={b} />
          <stop offset="1" stopColor={c} />
        </linearGradient>
      }
    >
      <GearShape slot={slot} m={id} gem={gem ?? '#9a90b0'} />
    </Svg>
  );
}

/** Пустой слот: тот же силуэт, приглушённый пунктиром. */
export function GearGhost({ slot }: { slot: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="iart iart--ghost">
      <g opacity=".35" style={{ filter: 'grayscale(1)' }}>
        <GearShape slot={slot} m="gm-ghost" gem="#5a5070" />
      </g>
      <defs>
        <linearGradient id="gm-ghost">
          <stop offset="0" stopColor="#3a3147" />
        </linearGradient>
      </defs>
    </svg>
  );
}
