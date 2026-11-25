import { useState } from 'react';
import { heroDef, skillDef } from '@/content';
import { compareHeroes, heroPower } from '@/game';
import { formatNumber, useT } from '@/i18n';
import { useGame } from '@/state/store';
import { unitArtUrl } from '@/assets/art';
import type { OwnedHero } from '@/save/schema';
import type { Stats } from '@/core/types';
import { ELEMENT_COLOR, FACTION_COLOR, RARITY_COLOR } from '../colors';
import { HeroTile, Stars } from './HeroTile';
import { SkillIcon } from './SkillIcon';

const PCT = new Set<keyof Stats>(['critRate', 'critDmg']);
const fmtStat = (k: keyof Stats, v: number) => (PCT.has(k) ? `${Math.round(v * 100)}%` : formatNumber(v));
const fmtDiff = (k: keyof Stats, d: number) => {
  const sign = d > 0 ? '+' : '−';
  const a = Math.abs(d);
  return PCT.has(k) ? `${sign}${Math.round(a * 100)}%` : `${sign}${formatNumber(a)}`;
};

function Head({
  h,
  power,
  win,
  onChange,
}: {
  h: OwnedHero;
  power: number;
  win: boolean;
  onChange: () => void;
}) {
  const t = useT();
  const d = heroDef(h.heroId);
  return (
    <div
      className="cmp__head"
      style={{ ['--rc' as string]: RARITY_COLOR[d.rarity], ['--fc' as string]: FACTION_COLOR[d.faction] }}
    >
      <img src={unitArtUrl(d.art)} alt="" />
      <b>{d.name}</b>
      <Stars n={h.stars} awakened={h.awakened} />
      <span>
        {t('heroes.level', { n: h.level })} ·{' '}
        <span style={{ color: ELEMENT_COLOR[d.element] }}>{t(`labels.element.${d.element}`)}</span>
      </span>
      <span>
        {t(`labels.role.${d.role}`)} · {t(`labels.factionShort.${d.faction}`)}
      </span>
      <span className={`cmp__power${win ? ' is-win' : ''}`}>
        {t('compare.power')} {formatNumber(power)}
      </span>
      <button type="button" className="btn" onClick={onChange}>
        {t('compare.change')}
      </button>
    </div>
  );
}

/** Выбор героя для сравнения и экран сравнения. */
export function HeroCompare({ base, onClose }: { base: OwnedHero; onClose: () => void }) {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const [a, setA] = useState<string>(base.uid);
  const [b, setB] = useState<string | null>(null);
  const [picking, setPicking] = useState<'a' | 'b' | null>('b');
  const ha = save.heroes.find((h) => h.uid === a);
  const hb = b ? save.heroes.find((h) => h.uid === b) : undefined;
  const others = [...save.heroes]
    .filter((h) => h.uid !== (picking === 'a' ? b : a))
    .sort((x, y) => heroPower(y, save) - heroPower(x, save));

  if (picking || !ha || !hb) {
    return (
      <div className="sheet-bg" onClick={onClose}>
        <div className="sheet2" onClick={(e) => e.stopPropagation()}>
          <h3>{t('compare.pick')}</h3>
          <div className="hgrid">
            {others.map((h) => (
              <HeroTile
                key={h.uid}
                def={heroDef(h.heroId)}
                owned={h}
                onClick={() => {
                  if (picking === 'a') setA(h.uid);
                  else setB(h.uid);
                  setPicking(null);
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const cmp = compareHeroes(save, ha, hb);

  return (
    <div className="cmp-overlay">
      <div className="cmp">
        <div className="cmp__top">
          <h3>{t('compare.title')}</h3>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setA(hb.uid);
              setB(ha.uid);
            }}
          >
            ⇄ {t('compare.swap')}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            {t('compare.close')}
          </button>
        </div>
        <div className="cmp__heads">
          <Head h={ha} power={cmp.powerA} win={cmp.powerA > cmp.powerB} onChange={() => setPicking('a')} />
          <Head h={hb} power={cmp.powerB} win={cmp.powerB > cmp.powerA} onChange={() => setPicking('b')} />
        </div>
        <p className="screen-sub" style={{ margin: 0 }}>
          {t('compare.hint')}
        </p>
        <h4>{t('compare.stats')}</h4>
        <div className="cmp__rows">
          {cmp.rows.map((r) => (
            <div className="cmp__row" key={r.key}>
              <b className={r.better === 'a' ? 'is-win' : undefined}>{fmtStat(r.key, r.a)}</b>
              <span>
                {t(`labels.stat.${r.key}`)}
                {r.better !== 'equal' && (
                  <em className={r.diff > 0 ? 'up' : 'down'}>{fmtDiff(r.key, r.diff)}</em>
                )}
              </span>
              <b className={r.better === 'b' ? 'is-win' : undefined}>{fmtStat(r.key, r.b)}</b>
            </div>
          ))}
        </div>
        <h4>{t('compare.skills')}</h4>
        <div className="cmp__skills">
          {[ha, hb].map((h) => {
            const d = heroDef(h.heroId);
            return (
              <div key={h.uid}>
                {d.skills.map((id) => {
                  const s = skillDef(id);
                  return (
                    <div className="cmp__skill" key={id}>
                      <span className="skill__ic">
                        <SkillIcon skill={s} color={ELEMENT_COLOR[d.element]} />
                      </span>
                      <b>{s.name}</b>
                      <small>{s.cooldown ? t('compare.cd', { n: s.cooldown }) : t('compare.noCd')}</small>
                      <p>{s.desc}</p>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
