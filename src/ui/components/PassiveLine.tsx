import { passiveOf } from '@/content';
import type { HeroDef } from '@/core/content';
import { useI18n, useT } from '@/i18n';

/** Врождённая пассивная способность героя — работает всегда, без перезарядки. */
export function PassiveLine({ def }: { def: HeroDef }) {
  const t = useT();
  const locale = useI18n((s) => s.locale);
  const p = passiveOf(def.id, def.art);
  if (!p) return null;
  const en = locale === 'en';
  return (
    <div className="skill skill--passive">
      <span className="skill__ic" aria-hidden>
        ✦
      </span>
      <div>
        <b>{en ? p.name.en : p.name.ru}</b>
        <small>{t('heroes.passive')}</small>
        <p>{en ? p.desc.en : p.desc.ru}</p>
      </div>
    </div>
  );
}
