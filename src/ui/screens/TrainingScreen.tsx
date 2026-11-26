import { useMemo, useState } from 'react';
import { heroDef } from '@/content';
import { heroLevelCap } from '@/core/stats';
import {
  TRAINING_HOURS,
  TRAINING_SLOT_UNLOCK,
  campLevel,
  claimTraining,
  heroPower,
  isBusy,
  levelAfter,
  planTraining,
  rushCost,
  rushTraining,
  startTraining,
  trainedXp,
  trainingRate,
  trainingSlots,
  xpToCap,
  type TrainingSlot,
} from '@/game';
import { formatNumber, useT } from '@/i18n';
import { useGame } from '@/state/store';
import { platform } from '@/state/services';
import type { OwnedHero } from '@/save/schema';
import { unitStillUrl } from '@/assets/art';
import { HeroTile } from '../components/HeroTile';
import { IconGold, IconShard } from '../components/icons';
import { RARITY_COLOR } from '../colors';
import { formatDuration, useNow } from '../hooks';
import './screens.css';
import './heroes.css';
import './training.css';

export default function TrainingScreen() {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const updateSave = useGame((s) => s.updateSave);
  const showToast = useGame((s) => s.showToast);
  const now = useNow(1000);
  const [picking, setPicking] = useState(false);
  const slots = trainingSlots(save);
  const camp = campLevel(save).level;

  const claim = (uid: string, early: boolean) => {
    let r: ReturnType<typeof claimTraining> = null;
    updateSave((s) => {
      r = claimTraining(s, uid, Date.now());
    });
    const res = r as ReturnType<typeof claimTraining>;
    if (!res) return;
    const name = heroDef(save.heroes.find((h) => h.uid === uid)!.heroId).name;
    showToast(
      res.up
        ? t('training.claimedUp', { name, xp: formatNumber(res.xp), from: res.up.from, to: res.up.to })
        : t('training.claimed', { name, xp: formatNumber(res.xp) }),
    );
    platform().audio.play(early ? 'tap' : 'reward');
    platform().haptics.notify('success');
  };
  const rush = (uid: string) => {
    let r: ReturnType<typeof rushTraining> = 'notFound';
    updateSave((s) => {
      r = rushTraining(s, uid, Date.now());
    });
    const res = r as ReturnType<typeof rushTraining>;
    if (res !== true) showToast(t(`training.err.${res}`));
  };

  return (
    <>
      <h2 className="screen-title">{t('training.title')}</h2>
      <p className="screen-sub">{t('training.hint')}</p>
      <p className="screen-sub tr-rate">
        {t('training.slots', { n: save.training.slots.length, max: slots })} ·{' '}
        {t('training.campBonus', { n: camp, p: Math.round(5 * (camp - 1)) })}
      </p>

      <div className="tr-list">
        {save.training.slots.map((s) => (
          <ActiveSlot key={s.heroUid} slot={s} now={now} onClaim={claim} onRush={rush} />
        ))}
        {save.training.slots.length < slots && (
          <button type="button" className="tr-empty" onClick={() => setPicking(true)}>
            <span>+</span>
            {t('training.add')}
          </button>
        )}
        {TRAINING_SLOT_UNLOCK.slice(slots).map((lv) => (
          <div key={lv} className="tr-locked">
            🔒 {t('training.locked', { n: lv })}
          </div>
        ))}
      </div>

      {picking && <Picker onClose={() => setPicking(false)} />}
    </>
  );
}

function ActiveSlot(props: {
  slot: TrainingSlot;
  now: number;
  onClaim: (uid: string, early: boolean) => void;
  onRush: (uid: string) => void;
}) {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const { slot, now } = props;
  const h = save.heroes.find((x) => x.uid === slot.heroUid);
  const [confirm, setConfirm] = useState(false);
  if (!h) return null;
  const d = heroDef(h.heroId);
  const done = now >= slot.endAt;
  const total = slot.endAt - slot.startAt;
  const pct = total > 0 ? Math.min(1, (now - slot.startAt) / total) : 1;
  const xpNow = trainedXp(slot, now);
  const xpEnd = trainedXp(slot, slot.endAt);
  const cost = rushCost(slot, now);
  return (
    <article
      className={`tr-slot${done ? ' is-done' : ''}`}
      style={{ ['--rc' as string]: RARITY_COLOR[d.rarity] }}
    >
      <img src={unitStillUrl(d.art)} alt="" />
      <div className="tr-main">
        <b>{d.name}</b>
        <small>
          {t('training.levels', { from: h.level, to: levelAfter(h, xpEnd) })} · +{formatNumber(xpNow)} /{' '}
          {formatNumber(xpEnd)}
        </small>
        <div className="tr-bar">
          <i style={{ width: `${pct * 100}%` }} />
        </div>
        <small>
          {done ? t('training.ready') : t('training.left', { time: formatDuration(slot.endAt - now) })}
        </small>
      </div>
      <div className="tr-acts">
        {done ? (
          <button type="button" className="btn btn--gold" onClick={() => props.onClaim(h.uid, false)}>
            {t('training.claim')}
          </button>
        ) : confirm ? (
          <>
            <button type="button" className="btn btn--danger" onClick={() => props.onClaim(h.uid, true)}>
              {t('training.stopYes')}
            </button>
            <button type="button" className="btn" onClick={() => setConfirm(false)}>
              {t('training.stopNo')}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn btn--gold"
              disabled={save.currencies.shards < cost}
              onClick={() => props.onRush(h.uid)}
            >
              ⚡ <IconShard /> {cost}
            </button>
            <button type="button" className="btn" onClick={() => setConfirm(true)}>
              {t('training.stop')}
            </button>
          </>
        )}
      </div>
      {confirm && <p className="tr-warn">{t('training.stopWarn', { xp: formatNumber(xpNow) })}</p>}
    </article>
  );
}

function Picker({ onClose }: { onClose: () => void }) {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const updateSave = useGame((s) => s.updateSave);
  const showToast = useGame((s) => s.showToast);
  const [uid, setUid] = useState<string | null>(null);
  const [hours, setHours] = useState<number>(4);
  const list = useMemo(
    () =>
      save.heroes
        .filter((h) => !isBusy(save, h.uid))
        .sort(
          (a, b) =>
            Number(save.team.includes(b.uid)) - Number(save.team.includes(a.uid)) ||
            heroPower(b) - heroPower(a),
        ),
    [save],
  );
  const hero = uid ? save.heroes.find((h) => h.uid === uid) : null;

  const start = () => {
    if (!hero) return;
    let r: ReturnType<typeof startTraining> = 'notFound';
    updateSave((s) => {
      r = startTraining(s, hero.uid, hours, Date.now());
    });
    const res = r as ReturnType<typeof startTraining>;
    if (typeof res === 'string') {
      showToast(t(`training.err.${res}`));
      platform().haptics.notify('warning');
      return;
    }
    showToast(t('training.started', { name: heroDef(hero.heroId).name }));
    platform().haptics.notify('success');
    onClose();
  };

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet2" onClick={(e) => e.stopPropagation()}>
        {!hero ? (
          <>
            <h3 style={{ fontSize: 18 }}>{t('training.pickHero')}</h3>
            <div className="hgrid tr-pick">
              {list.map((h) => (
                <HeroTile
                  key={h.uid}
                  def={heroDef(h.heroId)}
                  owned={h}
                  inTeam={save.team.includes(h.uid)}
                  dim={xpToCap(h) <= 0}
                  onClick={() => (xpToCap(h) <= 0 ? showToast(t('training.err.atCap')) : setUid(h.uid))}
                />
              ))}
            </div>
          </>
        ) : (
          <Plan hero={hero} hours={hours} setHours={setHours} onBack={() => setUid(null)} onStart={start} />
        )}
      </div>
    </div>
  );
}

function Plan(props: {
  hero: OwnedHero;
  hours: number;
  setHours: (h: number) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const { hero, hours } = props;
  const d = heroDef(hero.heroId);
  const plan = planTraining(save, hero, hours);
  const rate = trainingRate(hero.level, campLevel(save).level);
  const cap = heroLevelCap(d.rarity, hero.stars);
  const inTeam = save.team.includes(hero.uid);
  return (
    <div className="tr-plan">
      <div className="tr-plan__head">
        <img src={unitStillUrl(d.art)} alt="" style={{ borderColor: RARITY_COLOR[d.rarity] }} />
        <div>
          <b>{d.name}</b>
          <small>{t('training.rate', { n: formatNumber(rate.total) })}</small>
        </div>
        <button type="button" className="btn" onClick={props.onBack}>
          ←
        </button>
      </div>
      <div className="chips tr-hours">
        {TRAINING_HOURS.map((h) => (
          <button key={h} type="button" aria-pressed={hours === h} onClick={() => props.setHours(h)}>
            {t('training.hours', { n: h })}
          </button>
        ))}
      </div>
      <div className="tr-sum">
        <div>
          <span>{t('training.level')}</span>
          <b>
            {hero.level} → {plan.toLevel}
            <small> / {cap}</small>
          </b>
        </div>
        <div>
          <span>{t('training.xp')}</span>
          <b>+{formatNumber(plan.xp)}</b>
        </div>
        <div>
          <span>{t('training.time')}</span>
          <b>{formatDuration(plan.realMs)}</b>
        </div>
        <div>
          <span>{t('training.price')}</span>
          <b>
            <IconGold /> {formatNumber(plan.gold)}
          </b>
        </div>
      </div>
      {plan.capped && <p className="tr-note">{t('training.capped', { n: cap })}</p>}
      {inTeam && <p className="tr-note">{t('training.leavesTeam')}</p>}
      <p className="tr-note">{t('training.busyNote')}</p>
      <button
        type="button"
        className="btn btn--gold"
        disabled={plan.xp <= 0 || save.currencies.gold < plan.gold}
        onClick={props.onStart}
      >
        {save.currencies.gold < plan.gold ? t('training.err.noGold') : t('training.start')}
      </button>
    </div>
  );
}
