import { Rng, hashSeed } from '@/core/rng';

export interface StageEnemy {
  id: string;
  level: number;
  boss?: boolean;
  tier?: 'normal' | 'elite' | 'champion';
}

export interface StageDef {
  id: string;
  chapter: number;
  index: number;
  name: string;
  boss: boolean;
  waves: StageEnemy[][];
  energy: number;
  rewards: { gold: number; heroXp: number; playerXp: number };
  firstClear: { gold: number; shards: number };
}

export interface ChapterDef {
  id: number;
  name: string;
  desc: string;
  /** Ключ фона для рендера. */
  scene: 'mist' | 'cathedral' | 'forge' | 'dusk' | 'sky';
  stages: StageDef[];
}

interface ChapterSpec {
  name: string;
  desc: string;
  scene: ChapterDef['scene'];
  /** Прислужники главы: первые два — с первых этапов, остальные появляются дальше. */
  minions: [string, string, ...string[]];
  boss: string;
  baseLevel: number;
  energy: number;
  stageNames: string[];
}

const SPECS: ChapterSpec[] = [
  {
    name: 'Мглистые пустоши',
    desc: 'Пустоши у края Мглы. Здесь бродят призраки и гончие с кристаллами на спине.',
    scene: 'mist',
    minions: ['wraith', 'hound', 'shade_archer', 'gloom_knight'],
    boss: 'colossus',
    baseLevel: 1,
    energy: 6,
    stageNames: [
      'Опушка Мглы',
      'Сгоревший хутор',
      'Тропа гончих',
      'Плачущие камни',
      'Мёртвый брод',
      'Пепельный курган',
      'Стонущий лес',
      'Разрушенный маяк',
      'Порог Мглы',
      'Логово Колосса',
    ],
  },
  {
    name: 'Затонувший собор',
    desc: 'Собор под водой. Свет падает из окна-розы, в нефах плавают угри.',
    scene: 'cathedral',
    minions: ['drowned', 'eel', 'siren', 'crab'],
    boss: 'abbess',
    baseLevel: 15,
    energy: 8,
    stageNames: [
      'Затопленная паперть',
      'Галерея утопленников',
      'Хор глубин',
      'Ризница',
      'Неф угрей',
      'Колокольня',
      'Крипта',
      'Купель',
      'Алтарь приливов',
      'Покои Настоятельницы',
    ],
  },
  {
    name: 'Горнило Бездны',
    desc: 'Вулканическая кузня демонов. По земле текут лавовые реки.',
    scene: 'forge',
    minions: ['imp', 'golem', 'firedrake', 'cultist'],
    boss: 'emberlord',
    baseLevel: 31,
    energy: 10,
    stageNames: [
      'Пепельный тракт',
      'Плавильни',
      'Мост через лаву',
      'Кузня бесов',
      'Шлаковые копи',
      'Огненный зал',
      'Тигли',
      'Сердце горнила',
      'Трон углей',
      'Престол Владыки',
    ],
  },
  {
    name: 'Сумрачный предел',
    desc: 'Край мира, где Солнце навсегда застыло в затмении. Свет и тьма здесь воюют сами с собой.',
    scene: 'dusk',
    minions: ['dusk_wisp', 'eclipse_wolf', 'shard_golem', 'dusk_priest', 'star_lancer'],
    boss: 'eclipse_queen',
    baseLevel: 47,
    energy: 12,
    stageNames: [
      'Граница теней',
      'Поле застывших звёзд',
      'Волчья лощина',
      'Осколочный каньон',
      'Храм сумерек',
      'Мост затмения',
      'Хрустальный лес',
      'Обсерватория',
      'Венец полумрака',
      'Трон Королевы Затмения',
    ],
  },
  {
    name: 'Небесная цитадель',
    desc: 'Крепость Короля Бурь среди облаков. Сюда ведёт последняя тропа из Сумрачного предела.',
    scene: 'sky',
    minions: ['sky_sentinel', 'storm_harpy', 'sun_acolyte', 'cloud_serpent', 'gilded_knight'],
    boss: 'storm_king',
    baseLevel: 62,
    energy: 14,
    stageNames: [
      'Облачный мост',
      'Гнёзда гарпий',
      'Золотые ворота',
      'Сад ветров',
      'Звонница грома',
      'Небесные казармы',
      'Змеиный перевал',
      'Храм полудня',
      'Шпиль молний',
      'Трон Короля Бурь',
    ],
  },
];

export const STAGES_PER_CHAPTER = 10;

function buildStage(spec: ChapterSpec, chapter: number, index: number): StageDef {
  const id = `${chapter}-${index}`;
  const rng = new Rng(hashSeed(`stage:${id}`));
  const g = (chapter - 1) * STAGES_PER_CHAPTER + index; // сквозной номер этапа 1..30
  const level = Math.round(spec.baseLevel + (index - 1) * (chapter === 1 ? 1.25 : 1.4));
  const boss = index === STAGES_PER_CHAPTER;
  const waveCount = index <= 3 ? 2 : 3;
  const waves: StageEnemy[][] = [];
  for (let w = 0; w < waveCount; w++) {
    const last = w === waveCount - 1;
    if (boss && last) {
      waves.push([
        { id: spec.minions[0], level },
        { id: spec.boss, level: level + 2, boss: true },
        { id: spec.minions[1], level },
      ]);
      continue;
    }
    // В первой главе волны маленькие (обучение), дальше — сразу плотнее.
    const baseSize = chapter === 1 ? (index <= 2 ? 2 : index <= 5 ? 3 : 4) : index <= 3 ? 4 : 5;
    const size = Math.min(5, baseSize + (last && index >= 7 ? 1 : 0));
    const wave: StageEnemy[] = [];
    const pool = index <= 2 ? spec.minions.slice(0, 2) : index <= 5 ? spec.minions.slice(0, 3) : spec.minions;
    // Элита и чемпионы появляются чаще ближе к концу главы и в поздних главах.
    const eliteChance = chapter === 1 && index < 3 ? 0 : 0.06 + 0.025 * index + 0.05 * (chapter - 1);
    const champChance = index >= 6 ? 0.03 + 0.02 * (chapter - 1) : 0;
    for (let i = 0; i < size; i++) {
      const r = rng.next();
      const tier = r < champChance ? 'champion' : r < champChance + eliteChance ? 'elite' : 'normal';
      wave.push({ id: rng.pick(pool), level: Math.max(1, level - (w === 0 ? 1 : 0)), tier });
    }
    waves.push(wave);
  }
  return {
    id,
    chapter,
    index,
    name: spec.stageNames[index - 1] ?? `Этап ${id}`,
    boss,
    waves,
    energy: spec.energy,
    rewards: { gold: 120 + 45 * g, heroXp: 60 + 30 * g, playerXp: 10 + 3 * g },
    firstClear: { gold: 300 + 60 * g, shards: boss ? 120 : 30 },
  };
}

export const CHAPTERS: ChapterDef[] = SPECS.map((spec, ci) => ({
  id: ci + 1,
  name: spec.name,
  desc: spec.desc,
  scene: spec.scene,
  stages: Array.from({ length: STAGES_PER_CHAPTER }, (_, i) => buildStage(spec, ci + 1, i + 1)),
}));

export const ALL_STAGES: StageDef[] = CHAPTERS.flatMap((c) => c.stages);

export function stageById(id: string): StageDef | undefined {
  return ALL_STAGES.find((s) => s.id === id);
}

/** Следующий этап после данного (или undefined, если это последний). */
export function nextStage(id: string): StageDef | undefined {
  const i = ALL_STAGES.findIndex((s) => s.id === id);
  return i >= 0 ? ALL_STAGES[i + 1] : undefined;
}
