import { skinDef } from '@/content/skins';
import type { SaveData } from '@/save/schema';

/** Выбрать облик герою: только открытый (по звёздам); undefined — облик по умолчанию. */
export function setHeroSkin(save: SaveData, uid: string, skin?: string): true | 'notFound' | 'locked' {
  const h = save.heroes.find((x) => x.uid === uid);
  if (!h) return 'notFound';
  if (!skin) {
    delete h.skin;
    return true;
  }
  const d = skinDef(skin);
  if (!d) return 'notFound';
  if (h.stars < d.stars) return 'locked';
  h.skin = skin;
  if (!save.skins.includes(`${h.heroId}:${skin}`)) save.skins.push(`${h.heroId}:${skin}`);
  return true;
}
