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
  | 'chat'
  | 'settings'
  | 'placeholder';

export interface RewardLine {
  icon: 'gold' | 'shards' | 'xp' | 'energy' | 'level' | 'star' | 'item' | 'coin';
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
  go: (screen) => set({ screen }),
  openPlaceholder: (titleKey, stage) => set({ screen: 'placeholder', placeholder: { titleKey, stage } }),
  startBattle: (req) => set((s) => ({ battle: req, battleKey: s.battleKey + 1, screen: 'battle' })),
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
