import { useMemo, useState } from 'react';
import { HEROES, heroDef, scrollDef, skillDef } from '@/content';
import {
  baseStats,
  statsAt,
  STAT_KEYS,
  HERO_RARITY_ORDER,
  ELEMENTS,
  FACTIONS,
  ROLES,
  FACTION_BONUS,
} from '@/core';
import type { HeroDef } from '@/core/content';
import type { Element, Faction, HeroRarity, Role, Stats } from '@/core/types';
import {
  analyzeTeam,
  elementMatchups,
  enemyElements,
  goodPartners,
  heroPower,
  heroTags,
  RARITY_START_STARS,
  setTeam,
  summonChance,
  heroSources,
  type Advice,
} from '@/game';
import { formatNumber, useT } from '@/i18n';
import { useGame } from '@/state/store';
import type { OwnedHero, SaveData } from '@/save/schema';
import { unitArtUrl, unitStillUrl } from '@/assets/art';
import { HeroTile } from '../components/HeroTile';
import { SkillIcon } from '../components/SkillIcon';
import { MaterialIcon } from '../components/MaterialIcon';
import { ELEMENT_COLOR, FACTION_COLOR, RARITY_COLOR } from '../colors';
import './screens.css';
import './heroes.css';
import './codex.css';

type Tab = 'catalog' | 'planner';
type Own = 'all' | 'owned' | 'missing';
const PCT = new Set<keyof Stats>(['hp', 'atk', 'def', 'critRate', 'critDmg']);

/** Лучшая копия героя у игрока (по силе) и число копий. */
function ownedInfo(save: SaveData, heroId: string): { best?: OwnedHero; count: number } {
  const all = save.heroes.filter((h) => h.heroId === heroId);
  const best = all.reduce<OwnedHero | undefined>(
    (b, h) => (!b || heroPower(h, save) > heroPower(b, save) ? h : b),
    undefined,
  );
  return { best, count: all.length };
}

function useBonusText() {
  const t = useT();
  return (b: Partial<Stats> | null | undefined) =>
    b
      ? Object.entries(b)
          .map(([k, v]) => {
            const key = k as keyof Stats;
            const val = PCT.has(key) ? `+${Math.round((v as number) * 100)}%` : `+${v as number}`;
            return `${t(`labels.stat.${key}`)} ${val}`;
          })
          .join(', ')
      : t('codex.noBonus');
}

export default function CodexScreen() {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const [tab, setTab] = useState<Tab>('catalog');
  const [plan, setPlan] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const distinct = new Set(save.heroes.map((h) => h.heroId)).size;
  const addToPlan = (id: string) => {
    setPlan((p) => (p.includes(id) || p.length >= 5 ? p : [...p, id]));
    setOpenId(null);
    setTab('planner');
  };

  if (openId)
    return (
      <CodexCard def={heroDef(openId)} onBack={() => setOpenId(null)} onPlan={addToPlan} onOpen={setOpenId} />
    );

  return (
    <>
      <p className="screen-sub">{t('codex.sub', { owned: distinct, total: HEROES.length })}</p>
      <div className="cx-tabs" role="tablist">
        {(['catalog', 'planner'] as Tab[]).map((x) => (
          <button key={x} type="button" role="tab" aria-selected={tab === x} onClick={() => setTab(x)}>
            {t(x === 'catalog' ? 'codex.tabCatalog' : 'codex.tabPlanner')}
          </button>
        ))}
      </div>
      {tab === 'catalog' ? (
        <Catalog onOpen={setOpenId} />
      ) : (
        <Planner plan={plan} setPlan={setPlan} onOpen={setOpenId} />
      )}
    </>
  );
}

function Catalog({ onOpen }: { onOpen: (id: string) => void }) {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const [q, setQ] = useState('');
  const [faction, setFaction] = useState<Faction | 'all'>('all');
  const [element, setElement] = useState<Element | 'all'>('all');
  const [rarity, setRarity] = useState<HeroRarity | 'all'>('all');
  const [role, setRole] = useState<Role | 'all'>('all');
  const [own, setOwn] = useState<Own>('all');

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return HEROES.filter((d) => {
      const has = save.heroes.some((h) => h.heroId === d.id);
      return (
        (!needle || d.name.toLowerCase().includes(needle) || d.title.toLowerCase().includes(needle)) &&
        (faction === 'all' || d.faction === faction) &&
        (element === 'all' || d.element === element) &&
        (rarity === 'all' || d.rarity === rarity) &&
        (role === 'all' || d.role === role) &&
        (own === 'all' || (own === 'owned') === has)
      );
    }).sort(
      (a, b) =>
        HERO_RARITY_ORDER.indexOf(b.rarity) - HERO_RARITY_ORDER.indexOf(a.rarity) ||
        FACTIONS.indexOf(a.faction) - FACTIONS.indexOf(b.faction),
    );
  }, [save.heroes, q, faction, element, rarity, role, own]);

  return (
    <>
      <div className="filters">
        <input
          className="cx-search"
          type="search"
          value={q}
          placeholder={t('codex.search')}
          onChange={(e) => setQ(e.target.value)}
        />
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
          {(['all', ...HERO_RARITY_ORDER] as const).map((r) => (
            <button key={r} type="button" aria-pressed={rarity === r} onClick={() => setRarity(r)}>
              {r !== 'all' && <i style={{ ['--c' as string]: RARITY_COLOR[r] }} />}
              {r === 'all' ? t('heroes.all') : t(`labels.rarity.${r}`)}
            </button>
          ))}
        </div>
        <div className="chips">
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
          {(['owned', 'missing'] as const).map((o) => (
            <button
              key={o}
              type="button"
              aria-pressed={own === o}
              onClick={() => setOwn(own === o ? 'all' : o)}
            >
              {t(o === 'owned' ? 'codex.ownedOnly' : 'codex.missingOnly')}
            </button>
          ))}
        </div>
      </div>
      {list.length === 0 && <p className="screen-sub">{t('codex.empty')}</p>}
      <div className="hgrid">
        {list.map((d) => {
          const o = ownedInfo(save, d.id);
          return (
            <div key={d.id} className="cx-cell">
              <HeroTile def={d} owned={o.best} onClick={() => onOpen(d.id)} />
              {o.count > 1 && <span className="cx-copies">×{o.count}</span>}
              <span className="cx-chance">
                {d.pool === 'fusion' ? '⚗' : `${(summonChance(d) * 100).toFixed(2)}%`}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function CodexCard(props: {
  def: HeroDef;
  onBack: () => void;
  onPlan: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const bonusText = useBonusText();
  const d = props.def;
  const o = ownedInfo(save, d.id);
  const base = baseStats(d.role, d.rarity, d.mod);
  const s1 = statsAt(base, 1, RARITY_START_STARS[d.rarity]);
  const sMax = statsAt(base, 60, 6);
  const m = elementMatchups(d.element);
  const foes = enemyElements();
  const prey = [...new Set(m.strong.flatMap((e) => foes[e]))];
  const fmt = (k: keyof Stats, v: number) =>
    k === 'critRate' || k === 'critDmg' ? `${Math.round(v * 100)}%` : formatNumber(v);

  return (
    <div className="hd">
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn" onClick={props.onBack}>
          ← {t('heroes.back')}
        </button>
        <button
          type="button"
          className="btn btn--gold"
          style={{ marginLeft: 'auto' }}
          onClick={() => props.onPlan(d.id)}
        >
          + {t('codex.toPlanner')}
        </button>
      </div>
      <section
        className="hd__hero"
        style={{ ['--rc' as string]: RARITY_COLOR[d.rarity], ['--fc' as string]: FACTION_COLOR[d.faction] }}
      >
        <img src={unitArtUrl(d.art)} alt={d.name} />
        <div>
          <h2>{d.name}</h2>
          <p className="hd__title">{d.title}</p>
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
          <p className={`cx-own${o.count ? ' is-yes' : ''}`}>
            {o.count ? t('codex.owned', { n: o.count }) : t('codex.notOwned')}
          </p>
        </div>
      </section>

      <section className="card">
        <h3 className="cx-h">{t('codex.sources')}</h3>
        {d.rarity === 'mythic' && <p className="cx-line cx-muted">{t('codex.mythicNote')}</p>}
        {d.pool === 'fusion' && <p className="cx-line cx-muted">{t('codex.fusionOnly')}</p>}
        {heroSources(d).map((src) => {
          const sd = scrollDef(src.id);
          return (
            <p key={src.id} className="cx-line cx-src">
              <MaterialIcon id={sd.material} />
              <span>{sd.name}</span>
              <b>
                {(src.chance * 100).toFixed(2)}%
                {sd.chooseFaction ? ` · ${t(`labels.factionShort.${d.faction}`)}` : ''}
              </b>
            </p>
          );
        })}
      </section>

      <section className="card">
        <h3 className="cx-h">{t('codex.tags')}</h3>
        <div className="tags">
          {heroTags(d).map((x) => (
            <span key={x} className="tag cx-tag">
              {t(`tags.${x}`)}
            </span>
          ))}
        </div>
      </section>

      <section className="card">
        <h3 className="cx-h">{t('codex.element')}</h3>
        <p className="cx-line">
          {t('codex.strongVs')}:{' '}
          {m.strong.map((e) => (
            <b key={e} style={{ color: ELEMENT_COLOR[e], marginRight: 6 }}>
              {t(`labels.element.${e}`)}
            </b>
          ))}
        </p>
        <p className="cx-line">
          {t('codex.weakVs')}:{' '}
          {m.weak.map((e) => (
            <b key={e} style={{ color: ELEMENT_COLOR[e], marginRight: 6 }}>
              {t(`labels.element.${e}`)}
            </b>
          ))}
        </p>
        {prey.length > 0 && (
          <p className="cx-line cx-muted">
            {t('codex.enemies')}: {prey.join(', ')}
          </p>
        )}
      </section>

      <section className="card">
        <h3 className="cx-h">
          {t('codex.factionBonus')} ·{' '}
          <span style={{ color: FACTION_COLOR[d.faction] }}>{t(`labels.faction.${d.faction}`)}</span>
        </h3>
        {([3, 4, 5] as const).map((n) => (
          <p key={n} className="cx-line">
            <b>{t('codex.bonusAt', { n })}:</b> {bonusText(FACTION_BONUS[d.faction][n])}
          </p>
        ))}
      </section>

      <section className="card">
        <h3 className="cx-h">{t('codex.statsAt')}</h3>
        <table className="cx-stats">
          <thead>
            <tr>
              <th />
              <th>
                {t('codex.lvl1')} · {RARITY_START_STARS[d.rarity]}★
              </th>
              <th>{t('codex.lvlMax')}</th>
            </tr>
          </thead>
          <tbody>
            {STAT_KEYS.map((k) => (
              <tr key={k}>
                <td>{t(`labels.stat.${k}`)}</td>
                <td>{fmt(k, s1[k])}</td>
                <td>{fmt(k, sMax[k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h3 className="cx-h">{t('heroes.skills')}</h3>
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

      <section className="card">
        <h3 className="cx-h">{t('codex.partners')}</h3>
        <div className="cx-partners">
          {goodPartners(d).map((p) => {
            const pd = heroDef(p.id);
            return (
              <button key={p.id} type="button" className="cx-partner" onClick={() => props.onOpen(p.id)}>
                <img src={unitStillUrl(pd.art)} alt="" style={{ borderColor: RARITY_COLOR[pd.rarity] }} />
                <b>{pd.name}</b>
                <small>{t(p.reason === 'faction' ? 'codex.reasonFaction' : 'codex.reasonCovers')}</small>
              </button>
            );
          })}
        </div>
      </section>

      {d.lore && (
        <section className="card">
          <h3 className="cx-h">{t('heroes.lore')}</h3>
          <p className="cx-muted" style={{ margin: 0, fontSize: 14 }}>
            {d.lore}
          </p>
        </section>
      )}
    </div>
  );
}

function adviceText(t: ReturnType<typeof useT>, a: Advice): string {
  switch (a.kind) {
    case 'factionAlmost':
      return t('codex.adv.factionAlmost', { faction: t(`labels.factionShort.${a.faction}`) });
    case 'weakElement':
      return t('codex.adv.weakElement', { count: a.count, element: t(`labels.element.${a.element}`) });
    default:
      return t(`codex.adv.${a.kind}`);
  }
}

function Planner(props: {
  plan: string[];
  setPlan: (fn: (p: string[]) => string[]) => void;
  onOpen: (id: string) => void;
}) {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const updateSave = useGame((s) => s.updateSave);
  const showToast = useGame((s) => s.showToast);
  const bonusText = useBonusText();
  const [picking, setPicking] = useState(false);
  const { plan, setPlan } = props;
  const a = analyzeTeam(plan);
  const missingOwned = plan.filter((id) => !save.heroes.some((h) => h.heroId === id)).length;

  const apply = () => {
    if (missingOwned) return showToast(t('codex.needOwned', { n: missingOwned }));
    updateSave((s) =>
      setTeam(
        s,
        plan.map((id) => ownedInfo(s, id).best!.uid),
      ),
    );
    showToast(t('codex.applied'));
  };

  return (
    <>
      <p className="screen-sub">{t('codex.plannerHint')}</p>
      <div className="cx-slots">
        {Array.from({ length: 5 }, (_, i) => {
          const id = plan[i];
          if (!id)
            return (
              <button key={i} type="button" className="cx-slot is-empty" onClick={() => setPicking(true)}>
                +<small>{t('codex.slot')}</small>
              </button>
            );
          const d = heroDef(id);
          const has = save.heroes.some((h) => h.heroId === id);
          return (
            <div
              key={i}
              className={`cx-slot${has ? '' : ' is-missing'}`}
              style={{ borderColor: RARITY_COLOR[d.rarity] }}
            >
              <button type="button" className="cx-slot__art" onClick={() => props.onOpen(id)}>
                <img src={unitStillUrl(d.art)} alt={d.name} />
              </button>
              <span className="cx-slot__el" style={{ background: ELEMENT_COLOR[d.element] }} />
              <small>{d.name}</small>
              <button
                type="button"
                className="cx-slot__x"
                aria-label={t('codex.remove')}
                onClick={() => setPlan((p) => p.filter((x) => x !== id))}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      <div className="acts">
        <button type="button" className="btn" disabled={plan.length >= 5} onClick={() => setPicking(true)}>
          {t('codex.pick')}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() =>
            setPlan(() => [
              ...new Set(
                save.team
                  .map((u) => save.heroes.find((h) => h.uid === u)?.heroId)
                  .filter((x): x is string => !!x),
              ),
            ])
          }
        >
          {t('codex.fromTeam')}
        </button>
        <button type="button" className="btn" disabled={!plan.length} onClick={() => setPlan(() => [])}>
          {t('codex.clear')}
        </button>
        <button type="button" className="btn btn--gold" disabled={!plan.length} onClick={apply}>
          {t('codex.apply')}
        </button>
      </div>

      {plan.length > 0 && (
        <>
          <section className="card">
            <h3 className="cx-h">{t('codex.advice')}</h3>
            <ul className="cx-advice">
              {a.advice.map((x, i) => (
                <li key={i} className={x.kind === 'good' ? 'is-good' : ''}>
                  {adviceText(t, x)}
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h3 className="cx-h">{t('codex.factions')}</h3>
            {a.factions.map((f) => (
              <p key={f.faction} className="cx-line">
                <b style={{ color: FACTION_COLOR[f.faction] }}>
                  {t(`labels.factionShort.${f.faction}`)} ×{f.count}
                </b>{' '}
                — <span className={f.bonus ? '' : 'cx-muted'}>{bonusText(f.bonus)}</span>
              </p>
            ))}
          </section>

          <section className="card">
            <h3 className="cx-h">
              {t('codex.roles')} · {t('codex.elements')}
            </h3>
            <div className="tags">
              {ROLES.filter((r) => a.roles[r]).map((r) => (
                <span key={r} className="tag">
                  {t(`labels.role.${r}`)} ×{a.roles[r]}
                </span>
              ))}
              {ELEMENTS.filter((e) => a.elements[e]).map((e) => (
                <span key={e} className="tag" style={{ color: ELEMENT_COLOR[e] }}>
                  {t(`labels.element.${e}`)} ×{a.elements[e]}
                </span>
              ))}
            </div>
          </section>

          <section className="card">
            <h3 className="cx-h">{t('codex.coverage')}</h3>
            <div className="tags">
              {a.tags.map((x) => (
                <span key={x} className="tag cx-tag">
                  {t(`tags.${x}`)}
                </span>
              ))}
            </div>
            {a.missing.length > 0 && (
              <>
                <h3 className="cx-h" style={{ marginTop: 10 }}>
                  {t('codex.missing')}
                </h3>
                <div className="tags">
                  {a.missing.map((x) => (
                    <span key={x} className="tag cx-tag is-missing">
                      {t(`tags.${x}`)}
                    </span>
                  ))}
                </div>
              </>
            )}
          </section>
        </>
      )}

      {picking && (
        <div className="sheet-bg" onClick={() => setPicking(false)}>
          <div className="sheet2" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>{t('codex.pick')}</h3>
            <div className="hgrid cx-pick">
              {HEROES.filter((d) => !plan.includes(d.id)).map((d) => (
                <HeroTile
                  key={d.id}
                  def={d}
                  owned={ownedInfo(save, d.id).best}
                  onClick={() => {
                    setPlan((p) => (p.length >= 5 || p.includes(d.id) ? p : [...p, d.id]));
                    if (plan.length >= 4) setPicking(false);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
