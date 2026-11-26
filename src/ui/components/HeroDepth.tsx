import { PassiveLine } from './PassiveLine';
import { useState } from 'react';
import { heroDef, skillDef } from '@/content';
import { levelSkill } from '@/core/battle';
import {
  SKILL_MAX_LEVEL,
  TALENTS,
  TALENT_RESET_GOLD,
  canLearn,
  collectionOf,
  learnTalent,
  resetTalents,
  skillLevels,
  skillUpCost,
  talentPoints,
  upgradeSkill,
  type TalentBranch,
} from '@/game';
import { formatNumber, useT } from '@/i18n';
import { useGame } from '@/state/store';
import { platform } from '@/state/services';
import type { OwnedHero } from '@/save/schema';
import { SkillIcon } from './SkillIcon';
import { MaterialIcon } from './MaterialIcon';
import { ELEMENT_COLOR, FACTION_COLOR } from '../colors';
import './depth.css';

/** Навыки героя с уровнями и улучшением за книги. */
export function HeroSkills({ hero }: { hero: OwnedHero }) {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const updateSave = useGame((s) => s.updateSave);
  const showToast = useGame((s) => s.showToast);
  const d = heroDef(hero.heroId);
  const lv = skillLevels(hero);
  const up = (i: number) => {
    let r: ReturnType<typeof upgradeSkill> = 'notFound';
    updateSave((s) => {
      r = upgradeSkill(s, hero.uid, i);
    });
    const res = r as ReturnType<typeof upgradeSkill>;
    if (typeof res === 'string') {
      showToast(t(`depth.err.${res}`));
      platform().haptics.notify('warning');
    } else {
      showToast(t('depth.skillUp', { n: res }));
      platform().audio.play('reward');
    }
  };
  return (
    <section className="card">
      <div className="dp-head">
        <h3 style={{ fontSize: 16 }}>{t('heroes.skills')}</h3>
        <span className="dp-books">
          <MaterialIcon id="skillBook" /> {save.materials.skillBook}
        </span>
      </div>
      <PassiveLine def={d} />
      {d.skills.map((id, i) => {
        const base = skillDef(id);
        const s = levelSkill(base, lv[i]!);
        const next = lv[i]! < SKILL_MAX_LEVEL ? skillUpCost(lv[i]! + 1) : null;
        return (
          <div className="skill" key={id}>
            <span className="skill__ic">
              <SkillIcon skill={s} color={ELEMENT_COLOR[d.element]} />
            </span>
            <div>
              <b>
                {s.name} <span className="dp-lv">{t('depth.lv', { n: lv[i]!, max: SKILL_MAX_LEVEL })}</span>
              </b>
              <small>
                {s.cooldown ? t('heroes.cooldown', { n: s.cooldown }) : t('heroes.noCooldown')}
                {lv[i]! > 1 && ` · ${t('depth.power', { n: (lv[i]! - 1) * 10 })}`}
              </small>
              <p>{s.desc}</p>
              {next && (
                <button
                  type="button"
                  className="btn dp-up"
                  disabled={save.materials.skillBook < next.books || save.currencies.gold < next.gold}
                  onClick={() => up(i)}
                >
                  {t('depth.upgrade', { books: next.books, gold: formatNumber(next.gold) })}
                  {lv[i]! + 1 === SKILL_MAX_LEVEL && base.cooldown > 1 ? ` · ${t('depth.cdNote')}` : ''}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

const BRANCHES: TalentBranch[] = ['might', 'guard', 'grace'];

/** Таланты: три ветки по 4 узла, очко за каждые 5 уровней. */
export function HeroTalents({ hero }: { hero: OwnedHero }) {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const updateSave = useGame((s) => s.updateSave);
  const showToast = useGame((s) => s.showToast);
  const [confirm, setConfirm] = useState(false);
  const pts = talentPoints(hero);
  const learned = new Set(hero.talents ?? []);
  const learn = (id: string) => {
    let r: ReturnType<typeof learnTalent> = 'notFound';
    updateSave((s) => {
      r = learnTalent(s, hero.uid, id);
    });
    const res = r as ReturnType<typeof learnTalent>;
    if (res !== true) showToast(t(`depth.err.${res}`));
    else platform().haptics.impact('light');
  };
  const coll = collectionOf(save, heroDef(hero.heroId).faction);
  return (
    <section className="card">
      <div className="dp-head">
        <h3 style={{ fontSize: 16 }}>{t('depth.talents')}</h3>
        <span className="dp-pts">{t('depth.points', { free: pts.free, total: pts.total })}</span>
      </div>
      <p className="dp-hint">{t('depth.talentHint')}</p>
      <div className="dp-tree">
        {BRANCHES.map((b) => (
          <div key={b} className={`dp-branch b-${b}`}>
            <b>{t(`depth.branch.${b}`)}</b>
            {TALENTS.filter((n) => n.branch === b).map((n) => {
              const has = learned.has(n.id);
              const can = canLearn(hero, n.id) === true;
              return (
                <button
                  key={n.id}
                  type="button"
                  className={`dp-node${has ? ' is-on' : can ? ' is-can' : ''}`}
                  disabled={!can}
                  onClick={() => learn(n.id)}
                >
                  {t(`depth.node.${n.id}`)}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {learned.size > 0 &&
        (confirm ? (
          <div className="acts">
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                let r: ReturnType<typeof resetTalents> = 'notFound';
                updateSave((s) => {
                  r = resetTalents(s, hero.uid);
                });
                const res = r as ReturnType<typeof resetTalents>;
                if (res !== true) showToast(t(`depth.err.${res}`));
                setConfirm(false);
              }}
            >
              {t('depth.resetYes', { gold: formatNumber(TALENT_RESET_GOLD) })}
            </button>
            <button type="button" className="btn" onClick={() => setConfirm(false)}>
              {t('training.stopNo')}
            </button>
          </div>
        ) : (
          <button type="button" className="btn dp-reset" onClick={() => setConfirm(true)}>
            {t('depth.reset')}
          </button>
        ))}
      <p className="dp-coll" style={{ ['--fc' as string]: FACTION_COLOR[heroDef(hero.heroId).faction] }}>
        {t('depth.collection', {
          faction: t(`labels.factionShort.${heroDef(hero.heroId).faction}`),
          have: coll.have,
          total: coll.total,
          pct: Math.round(coll.pct * 100),
        })}
      </p>
    </section>
  );
}
