import type { MaterialId } from '@/save/schema';
import { MaterialArt } from './ItemArt';

/** Иконка материала (проработанная иллюстрация из ItemArt). */
export function MaterialIcon({ id }: { id: MaterialId }) {
  return <MaterialArt id={id} />;
}
