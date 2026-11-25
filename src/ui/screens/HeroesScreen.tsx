import { useMemo, useState } from 'react';
import { HEROES, heroDef, skillDef } from '@/content';
import { maxLevel, STAT_KEYS, RARITY_ORDER, ELEMENTS, FACTIONS, ROLES } from '@/core';
import type { Element, Faction, Rarity, Role } from '@/core/types';
import {
  AWAKEN_COST,
  awaken,
  heroPower,
  heroStats,
  heroXpToNext,
  isValidFodder,
  starUp,
  starUpCost,
  spendXpTomes,
  xpProgress,
  type ActionError,
} from '@/game';
import { formatNumber, useT } from '@/i18n';
import { useGame } from '@/state/store';
import { platform } from '@/state/services';
import { unitArtUrl } from '@/assets/art';
import type { OwnedHero, SaveData } from '@/save/schema';
import { HeroTile, Stars } from '../components/HeroTile';
import { ELEMENT_COLOR, FACTION_COLOR, RARITY_COLOR } from '../colors';
import { SkillIcon } from '../components/SkillIcon';
import { HeroGear } from '../components/HeroGear';
import './screens.css';
import './heroes.css';

type Sort = 'power' | 'level' | 'rarity';

export default function HeroesScreen() {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const [faction, setFaction] = useState<Faction | 'all'>('all');
  const [element, setElement] = useState<Element | 'all'>('all');
  const [rarity, setRarity] = useState<Rarity | 'all'>('all');
  const [role, setRole] = useState<Role | 'all'>('all');
  const [sort, setSort] = useState<Sort>('power');
  const [collection, setCollection] = useState(false);
  const [openUid, setOpenUid] = useState<string | null>(null);

  const list = useMemo(() => {
    const pass = (heroId: string) => {
      const d = heroDef(heroId);
      return (
        (faction === 'all' || d.faction === faction) &&
        (element === 'all' || d.element === element) &&
        (rarity === 'all' || d.rarity === rarity) &&
        (role === 'all' || d.role === role)
      );
    };
    const owned = save.heroes.filter((h) => pass(h.heroId));
    const key = (h: OwnedHero) =>
      sort === 'power'
        ? heroPower(h)
        : sort === 'level'
          ? h.level * 10 + h.stars
          : RARITY_ORDER.indexOf(heroDef(h.heroId).rarity) * 1000 + h.stars * 100 + h.level;
    owned.sort((a, b) => key(b) - key(a));
    const missing = collection
      ? HEROES.filter((d) => pass(d.id) && !save.heroes.some((h) => h.heroId === d.id))
      : [];
    return { owned, missing };
  }, [save.heroes, faction, element, rarity, role, sort, collection]);

  const opened = openUid ? save.heroes.find((h) => h.uid === openUid) : null;
  if (opened) return <HeroDetail hero={opened} onBack={() => setOpenUid(null)} />;

  const distinct = new Set(save.heroes.map((h) => h.heroId)).size;

  return (
    <>
      <h2 className="screen-title">{t('heroes.title')}</h2>
      <p className="screen-sub">{t('heroes.owned', { n: distinct, total: HEROES.length })}</p>
      <div className="filters">
        <div className="chips">
          <button type="button" aria-pressed={faction === 'all'} onClick={() => setFaction('all')}>
            {t('heroes.all')}
          </button>
          {FACTIONS.map((f) => (
            <button key={f} type="button" aria-pressed={faction === f} onClick={() => setFaction(f)}>
              <i style={{ ['--c' as string]: FACTION_COLOR[f] }} />
              {t(`labels.factionShort.${f}`)}
            </button>
          ))}
        </div>
        <div className="chips">
          {(['all', ...ELEMENTS] as const).map((e) => (
            <button key={e} type="button" aria-pressed={element === e} onClick={() => setElement(e)}>
              {e !== 'all' && (
                <i
                  style={{ ['--c' as string]: ELEMENT_COLOR[e], borderRadius: 1, transform: 'rotate(45deg)' }}
                />
              )}
              {e === 'all' ? t('heroes.all') : t(`labels.element.${e}`)}
            </button>
          ))}
        </div>
        <div className="chips">
          {(['all', ...RARITY_ORDER] as const).map((r) => (
            <button key={r} type="button" aria-pressed={rarity === r} onClick={() => setRarity(r)}>
              {r !== 'all' && <i style={{ ['--c' as string]: RARITY_COLOR[r] }} />}
              {r === 'all' ? t('heroes.all') : t(`labels.rarity.${r}`)}
            </button>
          ))}
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={role === r}
              onClick={() => setRole(role === r ? 'all' : r)}
            >
              {t(`labels.role.${r}`)}
            </button>
          ))}
        </div>
        <div className="chips">
          {(['power', 'level', 'rarity'] as Sort[]).map((s) => (
            <button key={s} type="button" aria-pressed={sort === s} onClick={() => setSort(s)}>
              {t(`heroes.sort${s[0]!.toUpperCase()}${s.slice(1)}`)}
            </button>
          ))}
          <button type="button" aria-pressed={collection} onClick={() => setCollection((c) => !c)}>
            {t('heroes.collection')}
          </button>
        </div>
      </div>
      <div className="hgrid">
        {list.owned.map((h) => (
          <HeroTile
            key={h.uid}
            def={heroDef(h.heroId)}
            owned={h}
            inTeam={save.team.includes(h.uid)}
            onClick={() => setOpenUid(h.uid)}
          />
        ))}
        {list.missing.map((d) => (
          <HeroTile key={d.id} def={d} />
        ))}
      </div>
    </>
  );
}

const PCT = new Set(['critRate', 'critDmg']);

function HeroDetail({ hero, onBack }: { hero: OwnedHero; onBack: () => void }) {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const updateSave = useGame((s) => s.updateSave);
  const showToast = useGame((s) => s.showToast);
  const [starSheet, setStarSheet] = useState(false);
  const d = heroDef(hero.heroId);
  const stats = heroStats(hero, save);
  const cap = maxLevel(hero.stars);
  const inTeam = save.team.includes(hero.uid);
  const p = platform();

  const run = (fn: (s: typeof save) => unknown, ok?: string) => {
    let res: unknown;
    updateSave((s) => {
      res = fn(s);
    });
    if (typeof res === 'string') {
      showToast(t(`heroes.err.${res as ActionError}`));
      p.haptics.notify('warning');
      return false;
    }
    if (ok) showToast(ok);
    p.haptics.notify('success');
    p.audio.play('reward');
    return true;
  };

  return (
    <div className="hd">
      <button type="button" className="btn" style={{ justifySelf: 'start' }} onClick={onBack}>
        ← {t('heroes.back')}
      </button>
      <section
        className="hd__hero"
        style={{ ['--rc' as string]: RARITY_COLOR[d.rarity], ['--fc' as string]: FACTION_COLOR[d.faction] }}
      >
        <img src={unitArtUrl(d.art)} alt={d.name} />
        <div>
          <h2>{d.name}</h2>
          <p className="hd__title">{d.title}</p>
          <Stars n={hero.stars} awakened={hero.awakened} />
          <div className="tags" style={{ marginTop: 6 }}>
            <span className="tag" style={{ color: RARITY_COLOR[d.rarity] }}>
              {t(`labels.rarity.${d.rarity}`)}
            </span>
            <span className="tag" style={{ color: ELEMENT_COLOR[d.element] }}>
              {t(`labels.element.${d.element}`)}
            </span>
            <span className="tag">{t(`labels.role.${d.role}`)}</span>
            <span className="tag" style={{ color: FACTION_COLOR[d.faction] }}>
              {t(`labels.factionShort.${d.faction}`)}
            </span>
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 13 }}>
            {t('heroes.level', { n: hero.level })} <span style={{ color: 'var(--muted)' }}>/ {cap}</span> ·{' '}
            {t('heroes.power', { n: formatNumber(heroPower(hero, save)) })}
          </p>
          <div className="xpbar">
            <i style={{ width: `${xpProgress(hero) * 100}%` }} />
          </div>
          <small style={{ color: 'var(--muted)', fontSize: 11 }}>
            {hero.level < cap
              ? `${formatNumber(hero.xp)} / ${formatNumber(heroXpToNext(hero.level))}`
              : t('heroes.maxLevel', { n: cap })}
          </small>
        </div>
      </section>

      <div className="acts">
        <button
          type="button"
          className="btn"
          disabled={hero.level >= cap || save.materials.xpTome <= 0}
          onClick={() => run((s) => spendXpTomes(s, hero.uid, 1))}
        >
          {t('heroes.useTome', { n: 1 })}
        </button>
        <button
          type="button"
          className="btn"
          disabled={hero.level >= cap || save.materials.xpTome <= 0}
          onClick={() => run((s) => spendXpTomes(s, hero.uid, 999))}
        >
          {t('heroes.toMax')}
        </button>
        <button
          type="button"
          className="btn btn--gold"
          disabled={hero.stars >= 6}
          onClick={() => setStarSheet(true)}
        >
          {t('heroes.starUp')}
        </button>
        <button
          type="button"
          className="btn"
          disabled={hero.awakened}
          title={t('heroes.awakenHint', { stones: AWAKEN_COST.stones, gold: formatNumber(AWAKEN_COST.gold) })}
          onClick={() => run((s) => awaken(s, hero.uid), t('heroes.awakenDone'))}
        >
          {hero.awakened ? t('heroes.awakened') : t('heroes.awaken')}
        </button>
        <button
          type="button"
          className="btn"
          style={{ gridColumn: '1 / -1' }}
          onClick={() => {
            if (!inTeam && save.team.length >= 5) return showToast(t('heroes.teamFull'));
            updateSave((s) => {
              s.team = inTeam ? s.team.filter((u) => u !== hero.uid) : [...s.team, hero.uid];
            });
          }}
        >
          {inTeam ? t('heroes.fromTeam') : t('heroes.toTeam')}
        </button>
      </div>
      <p className="screen-sub" style={{ margin: 0 }}>
        {t('heroes.tomes', { n: save.materials.xpTome })}
      </p>

      <section className="card">
        <h3 style={{ fontSize: 16, marginBottom: 6 }}>{t('heroes.stats')}</h3>
        <div className="stat-grid">
          {STAT_KEYS.map((k) => (
            <div key={k}>
              <span>{t(`labels.stat.${k}`)}</span>
              <b>{PCT.has(k) ? `${Math.round(stats[k] * 100)}%` : formatNumber(stats[k])}</b>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h3 style={{ fontSize: 16 }}>{t('heroes.skills')}</h3>
        {d.skills.map((id) => {
          const s = skillDef(id);
          return (
            <div className="skill" key={id}>
              <span className="skill__ic">
                <SkillIcon skill={s} color={ELEMENT_COLOR[d.element]} />
              </span>
              <div>
                <b>{s.name}</b>
                <small>{s.cooldown ? t('heroes.cooldown', { n: s.cooldown }) : t('heroes.noCooldown')}</small>
                <p>{s.desc}</p>
              </div>
            </div>
          );
        })}
      </section>

      <HeroGear hero={hero} />

      {d.lore && (
        <section className="card">
          <h3 style={{ fontSize: 16 }}>{t('heroes.lore')}</h3>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>{d.lore}</p>
        </section>
      )}

      {starSheet && <StarSheet hero={hero} onClose={() => setStarSheet(false)} onRun={run} />}
    </div>
  );
}

function StarSheet(props: {
  hero: OwnedHero;
  onClose: () => void;
  onRun: (fn: (s: SaveData) => unknown, ok?: string) => boolean;
}) {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const { hero } = props;
  const cost = starUpCost(hero.stars);
  const [picked, setPicked] = useState<string[]>([]);
  const cap = maxLevel(hero.stars);
  const fodder = save.heroes.filter((f) => isValidFodder(hero, f) && !save.team.includes(f.uid));
  const ready = hero.level >= cap;
  const toggle = (uid: string) =>
    setPicked((p) =>
      p.includes(uid) ? p.filter((u) => u !== uid) : p.length < cost.fodder ? [...p, uid] : p,
    );
  const done = (useFodder: boolean) => {
    const ok = props.onRun(
      (s) => starUp(s, hero.uid, useFodder ? picked : []),
      t('heroes.starDone', { n: hero.stars + 1 }),
    );
    if (ok) props.onClose();
  };
  return (
    <div className="sheet-bg" onClick={props.onClose}>
      <div className="sheet2" onClick={(e) => e.stopPropagation()}>
        <h3>{t('heroes.starUpTitle', { n: hero.stars + 1 })}</h3>
        {!ready && <p className="screen-sub">{t('heroes.starUpNeedMax', { n: cap })}</p>}
        <p className="screen-sub" style={{ margin: 0 }}>
          {t('heroes.gold', { n: `${formatNumber(save.currencies.gold)} / ${formatNumber(cost.gold)}` })}
        </p>
        <button
          type="button"
          className="btn btn--gold"
          disabled={!ready || save.materials.starDust < cost.dust}
          onClick={() => done(false)}
        >
          {t('heroes.payDust', { have: save.materials.starDust, need: cost.dust })}
        </button>
        <p className="screen-sub" style={{ margin: '6px 0 0' }}>
          {t('heroes.payFodder', { stars: hero.stars, n: cost.fodder })}
        </p>
        <div className="hgrid">
          {fodder.map((f) => (
            <HeroTile
              key={f.uid}
              def={heroDef(f.heroId)}
              owned={f}
              selected={picked.includes(f.uid)}
              onClick={() => toggle(f.uid)}
            />
          ))}
        </div>
        <button
          type="button"
          className="btn"
          disabled={!ready || picked.length !== cost.fodder}
          onClick={() => done(true)}
        >
          {t('heroes.confirm')} ({picked.length}/{cost.fodder})
        </button>
      </div>
    </div>
  );
}
