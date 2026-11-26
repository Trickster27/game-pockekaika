import { STORY, storyFor, stageById, type StoryScene } from '@/content';
import { useGame } from './store';

/** Не просмотренная ли сцена. */
function unseen(id: string): boolean {
  return !useGame.getState().save?.story.seen.includes(id);
}

/**
 * Сцена перед боем: вступление главы (первый этап) или встреча с боссом.
 * Если есть непросмотренная — показывает её и запускает бой после, возвращает true.
 */
export function storyBeforeStage(stageId: string, start: () => boolean): boolean {
  const scene = storyFor(stageId, 'intro') ?? storyFor(stageId, 'boss');
  const pre = [storyFor(stageId, 'intro'), storyFor(stageId, 'boss')].find((s) => s && unseen(s.id));
  if (!scene || !pre) return false;
  useGame.getState().playStory({ id: pre.id, then: () => void start() });
  return true;
}

/** После первой победы над боссом главы — развязка (покажется, когда игрок выйдет из боя). */
export function storyAfterStage(stageId: string) {
  const s = storyFor(stageId, 'outro');
  if (s && unseen(s.id)) useGame.getState().playStory({ id: s.id });
}

export function markStorySeen(id: string) {
  useGame.getState().updateSave((s) => {
    if (!s.story.seen.includes(id)) s.story.seen.push(id);
  });
}

/** Сцены, доступные в «Летописи»: по прогрессу кампании (даже если игрок их не видел). */
export function chronicle(): { scene: StoryScene; open: boolean }[] {
  const save = useGame.getState().save;
  if (!save) return [];
  const stars = save.campaign.stars;
  const cleared = (id: string) => (stars[id] ?? 0) > 0;
  const reached = (id: string) => {
    const st = stageById(id);
    if (!st) return false;
    const [c, n] = id.split('-').map(Number) as [number, number];
    if (c === 1 && n === 1) return true;
    const prev = n > 1 ? `${c}-${n - 1}` : `${c - 1}-10`;
    return cleared(prev) || cleared(id);
  };
  return STORY.filter((s) => stageById(s.stage)).map((scene) => ({
    scene,
    open:
      save.story.seen.includes(scene.id) ||
      (scene.trigger === 'outro' ? cleared(scene.stage) : reached(scene.stage)),
  }));
}
