import { useMemo, useState } from 'react';
import { SCROLLS, heroDef, scrollDef, type ScrollId } from '@/content';
import {
  trackQuest,
  PITY_EPIC,
  SUMMON_COST,
  heroChance,
  pityLeft,
  scrollPool,
  summon,
  summonEventPoints,
  featuredHero,
  rateUpEndsAt,
  type SummonPay,
} from '@/game';
import { FACTIONS, HERO_RARITY_ORDER, type Faction, type HeroRarity } from '@/core/types';
import { formatNumber, useT } from '@/i18n';
import { useGame } from '@/state/store';
import { platform } from '@/state/services';
import type { OwnedHero } from '@/save/schema';
import { unitArtUrl } from '@/assets/art';
import { SummonReveal } from '../components/SummonReveal';
import { formatDuration, useNow } from '../hooks';
import { FACTION_COLOR, RARITY_COLOR } from '../colors';
import { IconShard } from '../components/icons';
import { MaterialIcon } from '../components/MaterialIcon';
import './screens.css';
import './heroes.css';
import './summon.css';

export default function SummonScreen() {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const updateSave = useGame((s) => s.updateSave);
  const showToast = useGame((s) => s.showToast);
  const [scroll, setScroll] = useState<ScrollId>('basic');
  const [faction, setFaction] = useState<Faction | null>(null);
  const [showPool, setShowPool] = useState(false);
  const [result, setResult] = useState<{ heroes: OwnedHero[]; newIds: Set<string> } | null>(null);
  const [last, setLast] = useState<{ count: 1 | 10; pay: SummonPay; faction?: Faction } | null>(null);
  const p = platform();
  const def = scrollDef(scroll);
  const now = useNow(60_000);
  const have = save.materials[def.material];

  const doSummon = (count: 1 | 10, pay: SummonPay, fac = faction ?? undefined) => {
    const ownedBefore = new Set(save.heroes.map((h) => h.heroId));
    let res: ReturnType<typeof summon> = 'noShards';
    updateSave((s) => {
      res = summon(s, count, pay, Date.now(), { faction: fac });
      if (typeof res !== 'string') {
        trackQuest(s, 'summon', count);
        summonEventPoints(s, pay === 'shards' || pay === 'scroll' ? 'basic' : pay, count, Date.now());
      }
    });
    const r = res as ReturnType<typeof summon>;
    if (typeof r === 'string') {
      showToast(t(`summon.${r}`));
      p.haptics.notify('warning');
      return;
    }
    setLast({ count, pay, faction: fac });
    setResult({
      heroes: r.heroes,
      newIds: new Set(r.heroes.map((h) => h.heroId).filter((id) => !ownedBefore.has(id))),
    });
  };

  const pool = useMemo(() => scrollPool(scroll, faction ?? undefined), [scroll, faction]);
  const left = pityLeft(save, scroll);
  const epicLeft =
    scroll === 'basic'
      ? PITY_EPIC - save.summon.sinceEpic
      : def.epicEvery
        ? def.epicEvery - (save.summon.epicPity[scroll] ?? 0)
        : null;
  const needFaction = def.chooseFaction && !faction;

  return (
    <>
      <h2 className="screen-title">{t('summon.title')}</h2>
      <div className="scrolls" role="tablist">
        {SCROLLS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={scroll === s.id}
            className="scroll-tab"
            style={{ ['--sc' as string]: s.color }}
            onClick={() => {
              setScroll(s.id);
              setShowPool(false);
            }}
          >
            <MaterialIcon id={s.material} />
            <b>{s.name}</b>
            <span>×{save.materials[s.material]}</span>
          </button>
        ))}
      </div>

      <section className="altar" style={{ ['--sc' as string]: def.color }}>
        <svg className="crystal" viewBox="0 0 100 120" aria-hidden="true">
          <g stroke="#0a0710" strokeWidth="3" strokeLinejoin="round">
            <path d="M50 4 L20 50 L50 116 L80 50 Z" fill={def.color} />
            <path d="M50 4 L20 50 L50 50 Z" fill="#ffffff" opacity=".55" />
            <path d="M50 116 L80 50 L50 50 Z" fill="#000000" opacity=".3" />
          </g>
        </svg>
        <p className="altar__desc">{def.desc}</p>
        {featuredHero(scroll, now) && (
          <div className="rateup">
            <img src={unitArtUrl(heroDef(featuredHero(scroll, now)!).art)} alt="" />
            <span>
              <b>{t('summon.rateUp', { name: heroDef(featuredHero(scroll, now)!).name })}</b>
              <small>{t('summon.rateUpEnds', { time: formatDuration(rateUpEndsAt(now) - now) })}</small>
            </span>
          </div>
        )}
        <div className="rates">
          {HERO_RARITY_ORDER.filter((r) => def.rates[r]).map((r) => (
            <div key={r} style={{ ['--rc' as string]: RARITY_COLOR[r] }}>
              <b>{Math.round((def.rates[r] ?? 0) * 1000) / 10}%</b>
              {t(`labels.rarity.${r}`)}
            </div>
          ))}
        </div>
        <div className="pity">
          <span>{t('summon.pityOf', { rarity: t(`labels.rarity.${def.pity.rarity}`), n: left })}</span>
          <div className="bar">
            <i style={{ width: `${((def.pity.at - left) / def.pity.at) * 100}%` }} />
          </div>
          {epicLeft != null && <span>{t('summon.pityEpic', { n: epicLeft })}</span>}
        </div>
      </section>

      {def.chooseFaction && (
        <div className="chips scroll-factions">
          {FACTIONS.map((f) => (
            <button key={f} type="button" aria-pressed={faction === f} onClick={() => setFaction(f)}>
              <i style={{ ['--c' as string]: FACTION_COLOR[f] }} />
              {t(`labels.factionShort.${f}`)}
            </button>
          ))}
        </div>
      )}

      <div className="sum-btns">
        {scroll === 'basic' && (
          <>
            <button type="button" className="btn" onClick={() => doSummon(1, 'shards')}>
              {t('summon.one')}
              <small>
                <IconShard /> {SUMMON_COST.shards}
              </small>
            </button>
            <button type="button" className="btn btn--gold" onClick={() => doSummon(10, 'shards')}>
              {t('summon.ten')}
              <small>
                <IconShard /> {SUMMON_COST.shards10}
              </small>
            </button>
          </>
        )}
        <button
          type="button"
          className="btn"
          disabled={have < 1 || needFaction}
          data-tut={scroll === 'basic' ? 'summon-scroll' : undefined}
          onClick={() => doSummon(1, scroll)}
        >
          {t('summon.useOne')}
          <small>
            <MaterialIcon id={def.material} /> {t('summon.scrolls', { n: have })}
          </small>
        </button>
        <button
          type="button"
          className={`btn${scroll === 'basic' ? '' : ' btn--gold'}`}
          disabled={have < 10 || needFaction}
          onClick={() => doSummon(10, scroll)}
        >
          {t('summon.useTen')}
          <small>
            <MaterialIcon id={def.material} /> 10
          </small>
        </button>
      </div>
      {needFaction && <p className="screen-sub">{t('summon.pickFaction')}</p>}

      <section className="card">
        <button type="button" className="pool-toggle" onClick={() => setShowPool((v) => !v)}>
          <b>{t('summon.pool', { n: pool.length })}</b>
          <span>{showPool ? '▴' : '▾'}</span>
        </button>
        {showPool && (
          <div className="pool">
            {HERO_RARITY_ORDER.filter((r) => pool.some((h) => h.rarity === r))
              .reverse()
              .map((r: HeroRarity) => (
                <div key={r} className="pool__group">
                  <small style={{ color: RARITY_COLOR[r] }}>{t(`labels.rarity.${r}`)}</small>
                  <div className="pool__row">
                    {pool
                      .filter((h) => h.rarity === r)
                      .map((h) => {
                        const owned = save.heroes.some((x) => x.heroId === h.id);
                        return (
                          <div key={h.id} className={`pool__hero${owned ? '' : ' is-new'}`} title={h.name}>
                            <img
                              src={unitArtUrl(h.art)}
                              alt=""
                              style={{ borderColor: RARITY_COLOR[h.rarity] }}
                            />
                            <span>{h.name}</span>
                            <em>{(heroChance(h, scroll, faction ?? undefined) * 100).toFixed(2)}%</em>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
          </div>
        )}
        <p className="screen-sub" style={{ margin: '8px 0 0' }}>
          {t('summon.total', { n: formatNumber(save.summon.total) })} ·{' '}
          {t('summon.shards', { n: formatNumber(save.currencies.shards) })}
        </p>
      </section>

      {result && (
        <SummonReveal
          heroes={result.heroes}
          newIds={result.newIds}
          onClose={() => setResult(null)}
          onAgain={() => {
            setResult(null);
            if (last) doSummon(last.count, last.pay, last.faction);
          }}
        />
      )}
    </>
  );
}
