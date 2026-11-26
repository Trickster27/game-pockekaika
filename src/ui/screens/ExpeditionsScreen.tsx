import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { heroDef } from '@/content';
import {
  EXP_BONUS_MULT,
  activeParties,
  autoParty,
  busyUids,
  checkParty,
  claimExpedition,
  expRushCost,
  expeditionParties,
  expeditionReward,
  heroPower,
  recallExpedition,
  refreshCost,
  refreshExpeditions,
  rollExpeditions,
  rushExpedition,
  startExpedition,
  type ExpNeed,
  type ExpeditionMission,
} from '@/game';
import { useT } from '@/i18n';
import { useGame } from '@/state/store';
import { platform } from '@/state/services';
import { unitArtUrl } from '@/assets/art';
import { HeroTile } from '../components/HeroTile';
import { RewardChips } from '../components/RewardChips';
import { IconShard } from '../components/icons';
import { ELEMENT_COLOR, FACTION_COLOR, RARITY_COLOR } from '../colors';
import { formatDuration, useNow } from '../hooks';
import './screens.css';
import './heroes.css';
import './training.css';
import './expeditions.css';

const TIER_COLOR = ['#a59cb0', '#5fa8ff', '#b07cff', '#f0c860', '#ff5d7a'];

function needColor(n: ExpNeed): string {
  if (n.kind === 'faction') return FACTION_COLOR[n.value as keyof typeof FACTION_COLOR];
  if (n.kind === 'element') return ELEMENT_COLOR[n.value as keyof typeof ELEMENT_COLOR];
  return '#c9c2d6';
}

function useNeedLabel() {
  const t = useT();
  return (n: ExpNeed) =>
    n.kind === 'faction'
      ? t(`labels.factionShort.${n.value}`)
      : n.kind === 'element'
        ? t(`labels.element.${n.value}`)
        : t(`labels.role.${n.value}`);
}

function NeedChip({ n, ok, bonus }: { n: ExpNeed; ok?: boolean; bonus?: boolean }) {
  const t = useT();
  const label = useNeedLabel();
  return (
    <span
      className={`ex-need${ok === true ? ' is-ok' : ok === false ? ' is-no' : ''}${bonus ? ' is-bonus' : ''}`}
      style={{ ['--nc' as string]: needColor(n) }}
    >
      <i />
      {bonus ? t('exp.bonusAll', { what: label(n) }) : label(n)}
      {ok === true && ' ✓'}
    </span>
  );
}

export default function ExpeditionsScreen() {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const updateSave = useGame((s) => s.updateSave);
  const showToast = useGame((s) => s.showToast);
  const now = useNow(1000);
  const [picking, setPicking] = useState<string | null>(null);
  const st = save.expeditions;
  // Доска на сегодня создаётся при первом открытии экрана за день.
  const day = new Date(now).toISOString().slice(0, 10);
  useEffect(() => {
    if (st.day === day) return;
    const id = setTimeout(() => updateSave((s) => rollExpeditions(s, Date.now())));
    return () => clearTimeout(id);
  }, [st.day, day, updateSave]);

  const parties = expeditionParties(save);
  const active = activeParties(save);
  const cost = refreshCost(save);
  const list = [...st.board].sort((a, b) => rank(a, now) - rank(b, now) || b.tier - a.tier);

  const refresh = () => {
    let r: ReturnType<typeof refreshExpeditions> = 'noShards';
    updateSave((s) => {
      r = refreshExpeditions(s, Date.now());
    });
    if (r !== true) showToast(t('exp.err.noShards'));
    else platform().audio.play('tap');
  };
  const claim = (id: string) => {
    let r: ReturnType<typeof claimExpedition> = null;
    updateSave((s) => {
      r = claimExpedition(s, id, Date.now());
    });
    if (!r) return;
    showToast(t('exp.claimed'));
    platform().audio.play('reward');
    platform().haptics.notify('success');
  };

  return (
    <>
      <h2 className="screen-title">{t('exp.title')}</h2>
      <p className="screen-sub">{t('exp.hint')}</p>
      <div className="ex-top">
        <span>
          {t('exp.parties', { n: active, max: parties })}
          {parties < 4 && <small> · {t('exp.moreParties', { n: parties < 3 ? 4 : 8 })}</small>}
        </span>
        <button type="button" className="btn" onClick={refresh}>
          ↻ {t('exp.refresh')}{' '}
          <small>
            {cost === 0 ? (
              t('exp.free')
            ) : (
              <>
                <IconShard /> {cost}
              </>
            )}
          </small>
        </button>
      </div>

      <div className="ex-list">
        {list.map((m) => (
          <MissionCard
            key={m.id}
            m={m}
            now={now}
            full={active >= parties}
            onSend={() => setPicking(m.id)}
            onClaim={() => claim(m.id)}
          />
        ))}
        {list.length === 0 && <p className="screen-sub">{t('exp.empty')}</p>}
      </div>

      {picking && <PartySheet id={picking} onClose={() => setPicking(null)} />}
    </>
  );
}

/** Порядок: готовые, в пути, свободные, выполненные. */
function rank(m: ExpeditionMission, now: number) {
  if (m.done) return 3;
  if (m.party) return (m.endAt ?? 0) <= now ? 0 : 1;
  return 2;
}

function MissionCard(props: {
  m: ExpeditionMission;
  now: number;
  full: boolean;
  onSend: () => void;
  onClaim: () => void;
}) {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const updateSave = useGame((s) => s.updateSave);
  const showToast = useGame((s) => s.showToast);
  const [confirm, setConfirm] = useState(false);
  const { m, now } = props;
  const ready = !!m.party && !m.done && (m.endAt ?? 0) <= now;
  const going = !!m.party && !m.done && !ready;
  const total = (m.endAt ?? 0) - (m.startAt ?? 0);
  const pct = going && total > 0 ? Math.min(1, (now - m.startAt!) / total) : ready ? 1 : 0;
  const rush = going ? expRushCost(m, now) : 0;
  const reward = m.party || m.done ? expeditionReward(m) : m.reward;

  const doRush = () => {
    let r: ReturnType<typeof rushExpedition> = 'notFound';
    updateSave((s) => {
      r = rushExpedition(s, m.id, Date.now());
    });
    if (r === 'noShards') showToast(t('exp.err.noShards'));
  };
  const recall = () => {
    updateSave((s) => {
      recallExpedition(s, m.id);
    });
    setConfirm(false);
    showToast(t('exp.recalled'));
  };

  return (
    <article
      className={`ex-card${ready ? ' is-ready' : ''}${m.done ? ' is-done' : ''}`}
      style={{ ['--tc' as string]: TIER_COLOR[m.tier - 1] }}
    >
      <header>
        <b className="ex-tier">{'★'.repeat(m.tier)}</b>
        <span className="ex-meta">
          {t('exp.hours', { n: m.hours })} · {t('exp.size', { n: m.size })} ·{' '}
          {t('exp.minStars', { n: m.minStars })}
        </span>
      </header>
      <div className="ex-needs">
        {m.needs.map((n, i) => (
          <NeedChip key={i} n={n} />
        ))}
        {m.bonus && <NeedChip n={m.bonus} bonus ok={m.party ? m.bonusMet : undefined} />}
      </div>
      <div className="ex-reward">
        <RewardChips r={reward} />
        {m.bonus && !m.party && !m.done && (
          <small>{t('exp.bonusHint', { p: Math.round((EXP_BONUS_MULT - 1) * 100) })}</small>
        )}
      </div>

      {m.party && !m.done && (
        <div className="ex-party">
          {m.party.map((u) => {
            const h = save.heroes.find((x) => x.uid === u);
            if (!h) return null;
            const d = heroDef(h.heroId);
            return (
              <img
                key={u}
                src={unitArtUrl(d.art)}
                alt={d.name}
                style={{ borderColor: RARITY_COLOR[d.rarity] }}
              />
            );
          })}
          <div className="tr-bar ex-bar">
            <i style={{ width: `${pct * 100}%` }} />
          </div>
        </div>
      )}

      <footer>
        {m.done && <span className="ex-state">{t('exp.done')}</span>}
        {ready && (
          <button type="button" className="btn btn--gold" onClick={props.onClaim}>
            {t('exp.claim')}
          </button>
        )}
        {going && !confirm && (
          <>
            <span className="ex-state">{t('exp.left', { time: formatDuration(m.endAt! - now) })}</span>
            <button type="button" className="btn" onClick={() => setConfirm(true)}>
              {t('exp.recall')}
            </button>
            <button type="button" className="btn btn--gold" onClick={doRush}>
              {t('exp.rush')}{' '}
              <small>
                <IconShard /> {rush}
              </small>
            </button>
          </>
        )}
        {going && confirm && (
          <>
            <span className="ex-state ex-warn">{t('exp.recallWarn')}</span>
            <button type="button" className="btn" onClick={() => setConfirm(false)}>
              {t('training.stopNo')}
            </button>
            <button type="button" className="btn btn--danger" onClick={recall}>
              {t('exp.recallYes')}
            </button>
          </>
        )}
        {!m.party && !m.done && (
          <button
            type="button"
            className="btn btn--gold"
            disabled={props.full}
            onClick={props.onSend}
            title={props.full ? t('exp.err.noParty') : undefined}
          >
            {props.full ? t('exp.noFreeParty') : t('exp.send')}
          </button>
        )}
      </footer>
    </article>
  );
}

function PartySheet({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const updateSave = useGame((s) => s.updateSave);
  const showToast = useGame((s) => s.showToast);
  const m = save.expeditions.board.find((x) => x.id === id);
  const [party, setParty] = useState<string[]>(() => (m ? (autoParty(save, m) ?? []) : []));
  const busy = useMemo(() => busyUids(save), [save]);
  const list = useMemo(
    () =>
      save.heroes
        .filter((h) => !busy.has(h.uid))
        .sort(
          (a, b) =>
            Number(b.stars >= (m?.minStars ?? 1)) - Number(a.stars >= (m?.minStars ?? 1)) ||
            Number(save.team.includes(a.uid)) - Number(save.team.includes(b.uid)) ||
            heroPower(b) - heroPower(a),
        ),
    [save, busy, m?.minStars],
  );
  if (!m) return null;
  const check = checkParty(save, m, party);
  const toggle = (uid: string, stars: number) => {
    if (party.includes(uid)) return setParty(party.filter((u) => u !== uid));
    if (stars < m.minStars) return showToast(t('exp.err.stars', { n: m.minStars }));
    if (party.length >= m.size) return setParty([...party.slice(1), uid]);
    setParty([...party, uid]);
  };
  const auto = () => {
    const p = autoParty(save, m);
    if (!p) showToast(t('exp.err.noAuto'));
    else setParty(p);
  };
  const send = () => {
    let r: ReturnType<typeof startExpedition> = 'notFound';
    updateSave((s) => {
      r = startExpedition(s, m.id, party, Date.now());
    });
    if (r !== true) {
      showToast(t(`exp.err.${r}`));
      platform().haptics.notify('warning');
      return;
    }
    showToast(t('exp.sent'));
    platform().haptics.notify('success');
    onClose();
  };
  const leaving = party.filter((u) => save.team.includes(u)).length;

  return createPortal(
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet2 ex-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ex-sheet__head">
          <h3>
            <span style={{ color: TIER_COLOR[m.tier - 1] }}>{'★'.repeat(m.tier)}</span> {t('exp.pickTitle')}
          </h3>
          <button type="button" className="btn" onClick={auto}>
            {t('exp.auto')}
          </button>
        </div>
        <div className="ex-needs">
          <span className={`ex-need${check.stars ? ' is-ok' : party.length ? ' is-no' : ''}`}>
            {t('exp.minStars', { n: m.minStars })}
            {check.stars && ' ✓'}
          </span>
          {m.needs.map((n, i) => (
            <NeedChip key={i} n={n} ok={party.length ? check.needs[i] : undefined} />
          ))}
          {m.bonus && <NeedChip n={m.bonus} bonus ok={party.length ? check.bonus : undefined} />}
        </div>
        <div className="ex-slots">
          {Array.from({ length: m.size }, (_, i) => {
            const h = save.heroes.find((x) => x.uid === party[i]);
            if (!h) return <div key={i} className="ex-slot is-empty" />;
            const d = heroDef(h.heroId);
            return (
              <button
                key={i}
                type="button"
                className="ex-slot"
                onClick={() => toggle(h.uid, h.stars)}
                style={{ borderColor: RARITY_COLOR[d.rarity] }}
              >
                <img src={unitArtUrl(d.art)} alt="" />
                <small>{d.name}</small>
              </button>
            );
          })}
        </div>
        <div className="ex-reward">
          <RewardChips r={check.bonus ? expeditionReward({ ...m, bonusMet: true }) : m.reward} />
          <small>{t('exp.hours', { n: m.hours })}</small>
        </div>
        {leaving > 0 && <p className="tr-note">{t('exp.leavesTeam', { n: leaving })}</p>}
        <div className="hgrid tr-pick">
          {list.map((h) => (
            <HeroTile
              key={h.uid}
              def={heroDef(h.heroId)}
              owned={h}
              inTeam={save.team.includes(h.uid)}
              selected={party.includes(h.uid)}
              dim={h.stars < m.minStars}
              onClick={() => toggle(h.uid, h.stars)}
            />
          ))}
        </div>
        <button type="button" className="btn btn--gold" disabled={!check.ok} onClick={send}>
          {check.ok ? t('exp.go') : t('exp.notReady')}
        </button>
      </div>
    </div>,
    document.querySelector('.app') ?? document.body,
  );
}
