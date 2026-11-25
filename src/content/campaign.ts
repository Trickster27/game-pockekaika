import { Rng, hashSeed } from '@/core/rng';

export interface StageEnemy {
  id: string;
  level: number;
  boss?: boolean;
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
  scene: 'mist' | 'cathedral' | 'forge';
  stages: StageDef[];
}

interface ChapterSpec {
  name: string;
  desc: string;
  scene: ChapterDef['scene'];
  minions: [string, string];
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
    minions: ['wraith', 'hound'],
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
    minions: ['drowned', 'eel'],
    boss: 'abbess',
    baseLevel: 14,
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
    minions: ['imp', 'golem'],
    boss: 'emberlord',
    baseLevel: 28,
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
];

export const STAGES_PER_CHAPTER = 10;

function buildStage(spec: ChapterSpec, chapter: number, index: number): StageDef {
  const id = `${chapter}-${index}`;
  const rng = new Rng(hashSeed(`stage:${id}`));
  const g = (chapter - 1) * STAGES_PER_CHAPTER + index; // сквозной номер этапа 1..30
  const level = Math.round(spec.baseLevel + (index - 1) * 1.25);
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
    const size = Math.min(5, (index <= 2 ? 2 : index <= 5 ? 3 : 4) + (last && index >= 7 ? 1 : 0));
    const wave: StageEnemy[] = [];
    for (let i = 0; i < size; i++)
      wave.push({ id: rng.pick(spec.minions), level: Math.max(1, level - (w === 0 ? 1 : 0)) });
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
