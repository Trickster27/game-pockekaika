import { create } from 'zustand';
import type { SaveData, LoadSource } from '@/save';
import { saves } from './services';

export type ScreenId =
  'camp' | 'heroes' | 'team' | 'summon' | 'bag' | 'settings' | 'battleTest' | 'placeholder';

interface GameState {
  ready: boolean;
  save: SaveData | null;
  loadSource: LoadSource | null;
  screen: ScreenId;
  /** Для заглушек: какой раздел и на каком этапе он появится. */
  placeholder: { titleKey: string; stage: number } | null;
  toast: string | null;
  go: (screen: ScreenId) => void;
  openPlaceholder: (titleKey: string, stage: number) => void;
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
  toast: null,
  go: (screen) => set({ screen }),
  openPlaceholder: (titleKey, stage) => set({ screen: 'placeholder', placeholder: { titleKey, stage } }),
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
