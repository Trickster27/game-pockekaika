import { heroDef } from '@/content';
import { activeFactionBonus, factionCounts } from '@/core';
import type { Faction } from '@/core/types';
import { busyKind, heroPower, setTeam, teamPower } from '@/game';
import { formatNumber, useT } from '@/i18n';
import { useGame } from '@/state/store';
import { platform } from '@/state/services';
import { HeroTile } from '../components/HeroTile';
import { FACTION_COLOR } from '../colors';
import './screens.css';
import './heroes.css';

const PCT = new Set(['hp', 'atk', 'def', 'critDmg']);

export default function TeamScreen() {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const updateSave = useGame((s) => s.updateSave);
  const showToast = useGame((s) => s.showToast);
  const team = save.team.map((u) => save.heroes.find((h) => h.uid === u)).filter((h) => !!h);
  const counts = factionCounts(team.map((h) => heroDef(h.heroId).faction));
  const roster = [...save.heroes].sort((a, b) => heroPower(b) - heroPower(a));

  const toggle = (uid: string) => {
    platform().audio.play('tap');
    if (save.team.includes(uid))
      updateSave((s) =>
        setTeam(
          s,
          s.team.filter((u) => u !== uid),
        ),
      );
    else if (busyKind(save, uid))
      showToast(t(busyKind(save, uid) === 'training' ? 'training.inTraining' : 'exp.inExpedition'));
    else if (save.team.length >= 5) showToast(t('heroes.teamFull'));
    else updateSave((s) => setTeam(s, [...s.team, uid]));
  };

  const slot = (i: number) => {
    const h = team[i];
    if (!h)
      return (
        <span className="slot-empty" key={i}>
          {t('team.empty')}
        </span>
      );
    return <HeroTile key={h.uid} def={heroDef(h.heroId)} owned={h} onClick={() => toggle(h.uid)} />;
  };

  return (
    <>
      <h2 className="screen-title">{t('team.title')}</h2>
      <p className="screen-sub">{t('team.power', { n: formatNumber(teamPower(save)) })}</p>
      <section className="card team-slots">
        <div className="team-line">
          <small>{t('team.front')}</small>
          <div
            className="row5"
            style={{ gridTemplateColumns: 'repeat(2, minmax(0, 96px))', justifyContent: 'center' }}
          >
            {[0, 1].map(slot)}
          </div>
        </div>
        <div className="team-line">
          <small>{t('team.back')}</small>
          <div
            className="row5"
            style={{ gridTemplateColumns: 'repeat(3, minmax(0, 96px))', justifyContent: 'center' }}
          >
            {[2, 3, 4].map(slot)}
          </div>
        </div>
      </section>

      <section className="card bonus" style={{ marginTop: 10 }}>
        <b>{t('team.bonus')}</b>
        {[...counts.entries()].filter(([, n]) => n >= 2).length === 0 && (
          <span className="screen-sub" style={{ margin: 0 }}>
            {t('team.noBonus')}
          </span>
        )}
        {[...counts.entries()]
          .filter(([, n]) => n >= 2)
          .map(([f, n]) => {
            const bonus = activeFactionBonus(f as Faction, n);
            return (
              <div key={f} className={bonus ? 'on' : undefined}>
                <span style={{ color: FACTION_COLOR[f as Faction] }}>◆</span> {t(`labels.faction.${f}`)}: {n}
                /3+
                {bonus &&
                  ' — ' +
                    Object.entries(bonus)
                      .map(
                        ([k, v]) => `${t(`labels.stat.${k}`)} +${PCT.has(k) ? `${Math.round(v * 100)}%` : v}`,
                      )
                      .join(', ')}
              </div>
            );
          })}
      </section>

      <section className="card presets" style={{ marginTop: 10 }}>
        <b>{t('team.presets')}</b>
        {save.presets.map((p, i) => (
          <div className="preset" key={i}>
            <span>
              <b>{p.name}</b>
              {p.uids.length
                ? p.uids
                    .map((u) => heroDef(save.heroes.find((h) => h.uid === u)?.heroId ?? 'rikht').name)
                    .join(', ')
                : t('team.emptyPreset')}
            </span>
            <button
              type="button"
              className="btn"
              disabled={!p.uids.length}
              onClick={() => {
                updateSave((s) => setTeam(s, s.presets[i]!.uids));
                showToast(t('team.loaded'));
              }}
            >
              {t('team.load')}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                updateSave((s) => {
                  s.presets[i]!.uids = [...s.team];
                });
                showToast(t('team.saved'));
              }}
            >
              {t('team.saveTo')}
            </button>
          </div>
        ))}
      </section>

      <h3 style={{ margin: '16px 0 4px', fontSize: 17 }}>{t('team.roster')}</h3>
      <p className="screen-sub">{t('team.hint')}</p>
      <div className="hgrid">
        {roster.map((h) => (
          <HeroTile
            key={h.uid}
            def={heroDef(h.heroId)}
            owned={h}
            inTeam={save.team.includes(h.uid)}
            selected={save.team.includes(h.uid)}
            onClick={() => toggle(h.uid)}
          />
        ))}
      </div>
    </>
  );
}
