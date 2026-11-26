import { useCallback, useEffect, useRef, useState } from 'react';
import { Battle, chooseAction, type Action, type BattleResult, type BattleUnit } from '@/core/battle';
import { db } from '@/content';
import { formatNumber, useT } from '@/i18n';
import { useGame, type RepeatStop, type RewardLine } from '@/state/store';
import { mergeRewardLines } from '@/state/rewards';
import { INVENTORY_LIMIT } from '@/game';
import { platform } from '@/state/services';
import type { BattleView } from '@/render/pixi/battle/BattleView';
import { unitStillUrl } from '@/assets/art';
import { SkillIcon } from '../components/SkillIcon';
import { RewardIcon } from '../components/RewardIcon';
import { BattleStats } from '../components/BattleStats';
import './battle.css';

const ELEMENT_COLOR: Record<string, string> = {
  fire: '#ff7a2a',
  thorn: '#7fd08a',
  stone: '#c9a46a',
  tide: '#4fd6e0',
  light: '#fff0b8',
  dark: '#a37cff',
};
const FACTION_COLOR: Record<string, string> = {
  order: '#d9a94a',
  grove: '#5fb070',
  ash: '#5fbfb2',
  abyss: '#e0503a',
  forge: '#c98a45',
};

interface Pending {
  unit: BattleUnit;
  resolve: (a: Action) => void;
}

const Star = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" className={on ? 'on' : undefined} aria-hidden="true">
    <path
      d="M12 2 L14.6 9 L22 9 L16 13.5 L18.3 21 L12 16.5 L5.7 21 L8 13.5 L2 9 L9.4 9 Z"
      fill={on ? '#f0c860' : '#2a2236'}
      stroke="#0a0710"
      strokeWidth="1.5"
    />
  </svg>
);

export default function BattleScreen() {
  const t = useT();
  const req = useGame((s) => s.battle);
  const battleKey = useGame((s) => s.battleKey);
  const go = useGame((s) => s.go);
  const settings = useGame((s) => s.save?.settings);
  const updateSave = useGame((s) => s.updateSave);
  const repeat = useGame((s) => s.repeat);
  const setRepeat = useGame((s) => s.setRepeat);
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<BattleView | null>(null);
  const battleRef = useRef<Battle | null>(null);
  const autoRef = useRef(settings?.autoBattle ?? false);
  const pendingRef = useRef<Pending | null>(null);
  const selRef = useRef(0);
  const [auto, setAuto] = useState(settings?.autoBattle ?? false);
  const [speed, setSpeed] = useState<number>(settings?.battleSpeed ?? 1);
  const [paused, setPaused] = useState(false);
  const [askExit, setAskExit] = useState(false);
  const [actor, setActor] = useState<BattleUnit | null>(null);
  const [pending, setPending] = useState<BattleUnit | null>(null);
  const [sel, setSel] = useState(0);
  const [order, setOrder] = useState<BattleUnit[]>([]);
  const [wave, setWave] = useState({ n: 1, max: 1 });
  const [, force] = useState(0);
  const [result, setResult] = useState<{ r: BattleResult; lines: RewardLine[] } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bossHud, setBossHud] = useState({ turn: 0, dmg: 0 });
  const [resTab, setResTab] = useState<'rewards' | 'stats'>('rewards');

  const showTargets = useCallback((u: BattleUnit, idx: number) => {
    const b = battleRef.current;
    const skill = u.skills[idx];
    if (!b || !skill) return;
    viewRef.current?.setTargetable(skill.target === 'none' ? [] : b.validTargets(u, skill).map((x) => x.uid));
  }, []);

  const finishPending = useCallback((a: Action) => {
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    setPending(null);
    viewRef.current?.setTargetable([]);
    platform().haptics.impact('light');
    p.resolve(a);
  }, []);

  // Тап по бойцу на поле.
  const onUnitTap = useCallback(
    (uid: string) => {
      const p = pendingRef.current;
      const b = battleRef.current;
      if (!p || !b) return;
      const skill = p.unit.skills[selRef.current];
      if (!skill || skill.target === 'none') return;
      if (b.validTargets(p.unit, skill).some((x) => x.uid === uid))
        finishPending({ skillIndex: selRef.current, targetUid: uid });
    },
    [finishPending],
  );

  useEffect(() => {
    if (!req || !host.current) return;
    let alive = true;
    const el = host.current;
    setResult(null);
    setBossHud({ turn: 0, dmg: 0 });
    setResTab('rewards');
    setAskExit(false);
    setPaused(false);
    const p = platform();
    let lastHit = 0;
    void (async () => {
      const { BattleView } = await import('@/render/pixi/battle/BattleView');
      if (!alive) return;
      const view = await BattleView.create(el, {
        scene: req.scene,
        onUnitTap: (uid) => onUnitTap(uid),
        onImpact: (kind) => {
          const now = performance.now();
          if (kind === 'crit') {
            p.audio.play('crit');
            p.haptics.impact('heavy');
          } else if (kind === 'heal') p.audio.play('heal');
          else if (kind === 'death') p.haptics.impact('medium');
          else if (now - lastHit > 70) {
            lastHit = now;
            p.audio.play('hit');
          }
        },
      });
      if (!alive) {
        view.destroy();
        return;
      }
      view.speed = speed;
      viewRef.current = view;
      const battle = new Battle(req.setup, db);
      battleRef.current = battle;
      setWave({ n: 1, max: req.setup.waves.length });
      await view.setUnits(battle.units);
      let cursor = 0;
      const flush = async () => {
        const ev = battle.log.slice(cursor);
        cursor = battle.log.length;
        await view.play(ev, battle);
        setWave({ n: battle.wave + 1, max: req.setup.waves.length });
      };
      await flush();
      await view.wait(400);
      while (alive && !battle.result) {
        const u = battle.nextActor();
        if (u) {
          setActor({ ...u, cooldowns: [...u.cooldowns] });
          setOrder([
            u,
            ...battle
              .previewOrder(6)
              .map((id) => battle.unit(id)!)
              .filter(Boolean),
          ]);
        }
        await flush();
        if (!u || !alive) break;
        let action: Action;
        if (u.side === 'ally' && !autoRef.current) {
          const first =
            [...u.skills.keys()].reverse().find((i) => battle.isReady(u, i) && u.skills[i]!.cooldown > 0) ??
            0;
          selRef.current = first;
          setSel(first);
          showTargets(u, first);
          action = await new Promise<Action>((resolve) => {
            pendingRef.current = { unit: u, resolve };
            setPending({ ...u, cooldowns: [...u.cooldowns] });
          });
        } else {
          await view.wait(u.side === 'enemy' ? 260 : 160);
          action = chooseAction(battle, u);
        }
        // Игрок мог сдаться (бой на время): ход уже не нужен.
        if (!alive || battle.result) break;
        battle.act(u.uid, action.skillIndex, action.targetUid);
        force((n) => n + 1);
        if (req.mode === 'boss') setBossHud({ turn: battle.bossTurns, dmg: battle.damage });
        await flush();
      }
      if (!alive || !battle.result) return;
      setActor(null);
      view.setActive(null);
      const r = battle.result;
      setSubmitting(true);
      const lines = await Promise.resolve(req.finish(r)).finally(() => {
        if (alive) setSubmitting(false);
      });
      if (r.winner === 'ally') {
        p.audio.play('victory');
        p.haptics.notify('success');
      } else p.haptics.notify('error');
      await view.wait(500);
      if (!alive) return;
      // Серия повторов: следующий бой запускается сам, пока не сработает условие остановки.
      const rep = useGame.getState().repeat;
      if (rep && !rep.stop) {
        const next = {
          ...rep,
          done: rep.done + 1,
          wins: rep.wins + (r.winner === 'ally' ? 1 : 0),
          lines: [...rep.lines, lines],
        };
        const stop: RepeatStop | undefined =
          r.winner !== 'ally'
            ? 'defeat'
            : rep.stopRequested
              ? 'manual'
              : next.done >= next.total
                ? 'done'
                : (useGame.getState().save?.items.length ?? 0) >= INVENTORY_LIMIT
                  ? 'full'
                  : undefined;
        if (!stop) {
          useGame.getState().setRepeat(next);
          await view.wait(600);
          if (!alive) return;
          if (req.retry?.()) return;
          useGame.getState().setRepeat({ ...next, stop: 'energy' });
        } else useGame.getState().setRepeat({ ...next, stop });
      }
      setResult({ r, lines });
    })();
    return () => {
      alive = false;
      pendingRef.current = null;
      viewRef.current?.destroy();
      viewRef.current = null;
      battleRef.current = null;
    };
    // Бой перезапускается только при новом запросе (battleKey).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleKey]);

  useEffect(() => {
    if (viewRef.current) viewRef.current.speed = speed;
  }, [speed]);

  useEffect(() => {
    viewRef.current?.setPaused(paused || askExit);
  }, [paused, askExit]);

  const toggleAuto = () => {
    const v = !autoRef.current;
    autoRef.current = v;
    setAuto(v);
    // Выбор запоминается для следующих боёв.
    updateSave((s) => {
      s.settings.autoBattle = v;
    });
    const p = pendingRef.current;
    const b = battleRef.current;
    if (v && p && b) finishPending(chooseAction(b, p.unit));
  };

  const onSkill = (i: number) => {
    const p = pendingRef.current;
    const b = battleRef.current;
    if (!p || !b || !b.isReady(p.unit, i)) return;
    const skill = p.unit.skills[i]!;
    if (skill.target === 'none') return finishPending({ skillIndex: i });
    if (selRef.current === i) {
      // Повторное нажатие — автоматический выбор цели.
      const a = chooseAction(b, p.unit);
      const valid = b.validTargets(p.unit, skill);
      const target = a.skillIndex === i && a.targetUid ? a.targetUid : valid[0]?.uid;
      return finishPending({ skillIndex: i, targetUid: target });
    }
    selRef.current = i;
    setSel(i);
    showTargets(p.unit, i);
    platform().audio.play('tap');
  };

  if (!req) return null;
  const shown = pending ?? actor;
  const isAllyTurn = !!pending;
  const selSkill = shown?.skills[sel];

  return (
    <div className="bs">
      <div className="bs__top">
        <button className="chip" type="button" aria-label={t('battle.exit')} onClick={() => setAskExit(true)}>
          ✕
        </button>
        <div className="bs__title">
          <b>{req.title}</b>
          <span>
            {req.subtitle} ·{' '}
            {req.mode === 'boss'
              ? t('battle.bossHud', {
                  turn: bossHud.turn,
                  max: req.setup.bossTurns ?? 0,
                  dmg: formatNumber(bossHud.dmg),
                })
              : t('battle.wave', { n: wave.n, max: wave.max })}
          </span>
        </div>
        <button
          className={`chip${auto ? ' is-on' : ''}`}
          type="button"
          aria-pressed={auto}
          onClick={toggleAuto}
        >
          {t('battle.auto')}
        </button>
        <button
          className="chip"
          type="button"
          onClick={() => {
            const v = (speed >= 3 ? 1 : speed + 1) as 1 | 2 | 3;
            setSpeed(v);
            updateSave((s) => {
              s.settings.battleSpeed = v;
            });
          }}
        >
          ×{speed}
        </button>
        <button
          className="chip"
          type="button"
          aria-label={paused ? t('battle.resume') : t('battle.pause')}
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? '▶' : 'II'}
        </button>
      </div>
      {repeat && !repeat.stop && (
        <div className="rep-bar">
          <span>{t('repeat.progress', { n: repeat.done + 1, total: repeat.total })}</span>
          <button
            type="button"
            className="chip"
            disabled={repeat.stopRequested}
            onClick={() => setRepeat({ ...repeat, stopRequested: true })}
          >
            {repeat.stopRequested ? t('repeat.stopping') : t('repeat.stopBtn')}
          </button>
        </div>
      )}
      <div className="bs__order" aria-label={t('ui.turnOrder')}>
        {order.map((u, i) => (
          <span
            key={`${u.uid}-${i}`}
            className={`ord${i === 0 ? ' is-now' : ''}`}
            style={{
              ['--c' as string]:
                u.side === 'enemy' ? '#a37cff' : (FACTION_COLOR[u.faction ?? ''] ?? '#d9a94a'),
            }}
            title={u.name}
          >
            <img src={unitStillUrl(u.art)} alt="" />
          </span>
        ))}
      </div>
      <div className="bs__stage" ref={host} />
      <div className="bs__bottom">
        <div className="bs__who">
          <b>{shown ? shown.name : '…'}</b>
          <span>
            {shown ? (shown.side === 'enemy' ? t('battle.enemyTurn') : t('ui.lvl', { n: shown.level })) : ''}
          </span>
        </div>
        <div className="sk-row">
          {shown && shown.side === 'ally'
            ? shown.skills.map((s, i) => {
                const cd = shown.cooldowns[i] ?? 0;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`sk${isAllyTurn && sel === i ? ' is-sel' : ''}`}
                    style={{ ['--sc' as string]: ELEMENT_COLOR[shown.element] }}
                    data-cd={cd > 0 ? cd : undefined}
                    disabled={!isAllyTurn || cd > 0}
                    onClick={() => onSkill(i)}
                  >
                    <span className="sk__medal">
                      <SkillIcon skill={s} color={ELEMENT_COLOR[shown.element] ?? '#fff'} />
                    </span>
                    <span className="sk__name">{s.name}</span>
                    {i > 0 && s.cooldown > 0 && cd === 0 && <i className="sk__ready" />}
                  </button>
                );
              })
            : [0, 1, 2].map((i) => <div key={i} className="sk" style={{ opacity: 0.35 }} />)}
        </div>
        <p className="bs__hint">
          {isAllyTurn && selSkill
            ? selSkill.target === 'none'
              ? selSkill.desc
              : `${selSkill.desc} ${t('battle.pickTarget')}`
            : ''}
        </p>
      </div>

      {askExit && (
        <div className="overlay">
          <div className="res res--lose">
            <h2 style={{ fontSize: 22 }}>{t('battle.exit')}</h2>
            <p>{req.mode === 'boss' ? t('battle.exitBoss') : t('battle.exitConfirm')}</p>
            <div className="btns">
              <button type="button" className="btn" onClick={() => setAskExit(false)}>
                {t('battle.stay')}
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => {
                  const b = battleRef.current;
                  if (req.mode === 'boss' && b && !b.result) {
                    // Бой на время: выход засчитывает уже нанесённый урон.
                    b.surrender();
                    setAskExit(false);
                    const p = pendingRef.current;
                    if (p) {
                      pendingRef.current = null;
                      setPending(null);
                      p.resolve({ skillIndex: 0 });
                    }
                    return;
                  }
                  go(req.returnTo);
                }}
              >
                {req.mode === 'boss' ? t('battle.leaveBoss') : t('battle.leave')}
              </button>
            </div>
          </div>
        </div>
      )}

      {submitting && !result && (
        <div className="overlay">
          <div className="res">
            <p>{t('battle.submitting')}</p>
          </div>
        </div>
      )}

      {result && (
        <div className="overlay">
          <div className={`res${result.r.winner === 'ally' || req.mode === 'boss' ? '' : ' res--lose'}`}>
            <h2>
              {repeat?.stop
                ? t('repeat.title', { n: repeat.done })
                : req.resultTitle
                  ? req.resultTitle(result.r)
                  : result.r.winner === 'ally'
                    ? t('battle.victory')
                    : result.r.winner === 'draw'
                      ? t('battle.draw')
                      : t('battle.defeat')}
            </h2>
            {req.mode === 'boss' ? null : result.r.winner === 'ally' ? (
              <div className="stars">
                {[1, 2, 3].map((n) => (
                  <Star key={n} on={result.r.stars >= n} />
                ))}
              </div>
            ) : (
              <p>{t('battle.defeatHint')}</p>
            )}
            {repeat?.stop && (
              <p className="rep-note">
                {t(`repeat.stop.${repeat.stop}`, { n: repeat.done, wins: repeat.wins })}
              </p>
            )}
            {result.r.report && result.r.report.length > 0 && (
              <div className="res-tabs">
                <button
                  type="button"
                  aria-pressed={resTab === 'rewards'}
                  onClick={() => setResTab('rewards')}
                >
                  {t('stats.tabRewards')}
                </button>
                <button type="button" aria-pressed={resTab === 'stats'} onClick={() => setResTab('stats')}>
                  {t('stats.tabStats')}
                </button>
              </div>
            )}
            {resTab === 'stats' && result.r.report ? (
              <BattleStats report={result.r.report} />
            ) : (
              <div className="rw-list">
                {(repeat?.stop ? mergeRewardLines(repeat.lines) : result.lines).map((l) => (
                  <div className="rw-line" key={l.label}>
                    <RewardIcon icon={l.icon} mat={l.mat} />
                    <span>{l.label}</span>
                    <b>{l.value}</b>
                  </div>
                ))}
              </div>
            )}
            <div className="btns">
              {result.r.winner === 'ally' && req.next && (
                <button type="button" className="btn btn--gold" onClick={() => req.next?.()}>
                  {req.nextLabel ?? t('battle.next')}
                </button>
              )}
              {req.retry && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setRepeat(null);
                    req.retry?.();
                  }}
                >
                  {t('battle.retry')}
                </button>
              )}
              {req.repeatable && req.retry && result.r.winner === 'ally' && (
                <div className="rep-pick">
                  <span>{t('repeat.label')}</span>
                  {[5, 10, 30].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className="chip"
                      onClick={() => {
                        // Текущий бой уже засчитан: серия продолжает его.
                        setRepeat({ total: n, done: 1, wins: 1, lines: [result.lines] });
                        autoRef.current = true;
                        setAuto(true);
                        req.retry?.();
                      }}
                    >
                      ×{n}
                    </button>
                  ))}
                </div>
              )}
              <button type="button" className="btn" onClick={() => go(req.returnTo)}>
                {t('battle.back')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
