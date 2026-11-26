import type { MaterialId } from '@/save/schema';
import { create } from 'zustand';
import type { SaveData, LoadSource } from '@/save';
import type { BattleResult, BattleSetup } from '@/core/battle';
import type { SceneKey } from '@/render/pixi/battle/background';
import { saves } from './services';

export type ScreenId =
  | 'camp'
  | 'campaign'
  | 'battle'
  | 'heroes'
  | 'codex'
  | 'team'
  | 'summon'
  | 'bag'
  | 'shop'
  | 'dungeons'
  | 'tower'
  | 'arena'
  | 'quests'
  | 'account'
  | 'friends'
  | 'clan'
  | 'training'
  | 'expeditions'
  | 'raid'
  | 'leaders'
  | 'fusion'
  | 'events'
  | 'chat'
  | 'settings'
  | 'placeholder';

export interface RewardLine {
  icon: 'gold' | 'shards' | 'xp' | 'energy' | 'level' | 'star' | 'item' | 'coin';
  /** Материал: строка награды показывает его собственную иконку. */
  mat?: MaterialId;
  label: string;
  value: string;
}

/** Запрос на бой: любой режим (кампания, башня, подземелья, арена) описывает себя так. */
export interface BattleRequest {
  title: string;
  subtitle: string;
  scene: SceneKey;
  setup: BattleSetup;
  /** Экран, куда вернуться после боя. */
  returnTo: ScreenId;
  /** Применить результат к сейву и вернуть строки наград для экрана итогов (может ждать сервер). */
  finish: (result: BattleResult) => RewardLine[] | Promise<RewardLine[]>;
  /** Можно запускать серией повторов (кампания, подземелья). */
  repeatable?: boolean;
  /** Бой с боссом на время: показывает ходы босса и урон, выход засчитывает урон. */
  mode?: 'boss';
  /** Свой заголовок итогов. */
  resultTitle?: (result: BattleResult) => string;
  /** Следующий бой (например, следующий этап), если есть. */
  next?: () => boolean;
  nextLabel?: string;
  retry?: () => boolean;
}

interface GameState {
  ready: boolean;
  save: SaveData | null;
  loadSource: LoadSource | null;
  screen: ScreenId;
  placeholder: { titleKey: string; stage: number } | null;
  battle: BattleRequest | null;
  /** Счётчик запусков боя: меняется при каждом новом бое, даже если экран тот же. */
  battleKey: number;
  toast: string | null;
  idleOpen: boolean;
  setIdleOpen: (v: boolean) => void;
  go: (screen: ScreenId) => void;
  openPlaceholder: (titleKey: string, stage: number) => void;
  startBattle: (req: BattleRequest) => void;
  updateSave: (mutator: (draft: SaveData) => void) => void;
  showToast: (text: string) => void;
  /** Сводка (зачистка, серия повторов). */
  summary: { title: string; note?: string; lines: RewardLine[] } | null;
  showSummary: (s: { title: string; note?: string; lines: RewardLine[] } | null) => void;
  /** Сюжетная сцена на экране; then — что сделать после (например, начать бой). */
  story: { id: string; then?: () => void; replay?: boolean } | null;
  playStory: (s: { id: string; then?: () => void; replay?: boolean } | null) => void;
  /** Серия повторов боя. */
  repeat: RepeatState | null;
  setRepeat: (r: RepeatState | null) => void;
}

export type RepeatStop = 'done' | 'energy' | 'defeat' | 'full' | 'manual';
export interface RepeatState {
  /** Сколько боёв всего в серии и сколько уже закончено. */
  total: number;
  done: number;
  wins: number;
  lines: RewardLine[][];
  /** Игрок нажал «Стоп»: серия закончится после текущего боя. */
  stopRequested?: boolean;
  stop?: RepeatStop;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useGame = create<GameState>((set) => ({
  ready: false,
  save: null,
  loadSource: null,
  screen: 'camp',
  placeholder: null,
  battle: null,
  battleKey: 0,
  toast: null,
  idleOpen: false,
  setIdleOpen: (v) => set({ idleOpen: v }),
  go: (screen) => set({ screen, repeat: null }),
  openPlaceholder: (titleKey, stage) => set({ screen: 'placeholder', placeholder: { titleKey, stage } }),
  startBattle: (req) => set((s) => ({ battle: req, battleKey: s.battleKey + 1, screen: 'battle' })),
  summary: null,
  showSummary: (summary) => set({ summary }),
  story: null,
  playStory: (story) => set({ story }),
  repeat: null,
  setRepeat: (repeat) => set({ repeat }),
  updateSave: (mutator) => {
    const next = saves().update(mutator);
    set({ save: next });
  },
  showToast: (text) => {
    clearTimeout(toastTimer);
    set({ toast: text });
    toastTimer = setTimeout(() => set({ toast: null }), 2600);
  },
}));
