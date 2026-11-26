import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CHEST_TIERS,
  CLAN,
  CLAN_COLORS,
  CLAN_EMBLEMS,
  CLAN_SHOP,
  DONATIONS,
  WEEKLY_GOALS,
  bossElement,
  bossHp,
  bossPicks,
  buyClanOffer,
  chestTier,
  clanLevel,
  clanPerks,
  clanShopBought,
  msToNextDay,
  normalizeTag,
  setTeam,
  teamHeroes,
  teamPower,
  validateClanName,
  validateClanTag,
  weeklyReward,
  type ClanBuyError,
  type ClanEmblem as Emblem,
  type JoinMode,
} from '@/game';
import { CLAN_BOSS_SKILLS, heroDef } from '@/content';
import { isOnline, type ClanInfo, type ClanMemberInfo, type ClanState } from '@/online';
import { formatNumber, useT } from '@/i18n';
import { useGame } from '@/state/store';
import { useOnline } from '@/state/online';
import { platform } from '@/state/services';
import {
  cancelRequestAction,
  checkinAction,
  claimKillAction,
  claimRankAction,
  claimWeeklyAction,
  closePopup,
  createClanAction,
  donateAction,
  joinClanAction,
  kickAction,
  leaveClanAction,
  refreshClan,
  rewardLines,
  respondAction,
  searchClans,
  sendClanMessageAction,
  setChatOpen,
  setRoleAction,
  startClanBoss,
  systemText,
  transferAction,
  updateClanAction,
  useClan,
} from '@/state/clan';
import { unitArtUrl } from '@/assets/art';
import { ClanEmblem } from '../components/ClanEmblem';
import { RewardIcon } from '../components/RewardIcon';
import { MaterialIcon } from '../components/MaterialIcon';
import type { MaterialId } from '@/save/schema';
import { SkillIcon } from '../components/SkillIcon';
import { ELEMENT_COLOR } from '../colors';
import { formatDuration, useNow } from '../hooks';
import './screens.css';
import './heroes.css';
import './codex.css';
import './clan.css';

type Tab = 'overview' | 'boss' | 'members' | 'chat' | 'shop';

export default function ClanScreen() {
  const t = useT();
  const userId = useOnline((s) => s.userId);
  const go = useGame((s) => s.go);
  const { loaded, state, popup } = useClan();

  useEffect(() => {
    if (userId) void refreshClan();
  }, [userId]);

  if (!userId)
    return (
      <section className="card clan-hero">
        <h2>{t('clan.heroTitle')}</h2>
        <p>{t('clan.needLogin')}</p>
        <button type="button" className="btn btn--gold" onClick={() => go('account')}>
          {t('clan.toAccount')}
        </button>
      </section>
    );

  return (
    <>
      {!loaded ? (
        <p className="screen-sub">{t('clan.loading')}</p>
      ) : state ? (
        <InClan st={state} />
      ) : (
        <NoClan />
      )}
      {popup && (
        <div className="sheet-bg" onClick={closePopup}>
          <div className="sheet2" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 18 }}>{popup.title}</h3>
            <div className="rw-list">
              {popup.lines.map((l, i) => (
                <div className="rw-line" key={i}>
                  <RewardIcon icon={l.icon} />
                  <span>{l.label}</span>
                  <b>{l.value}</b>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn--gold" onClick={closePopup}>
              OK
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ———————————————————— без клана ————————————————————

function NoClan() {
  const t = useT();
  const [tab, setTab] = useState<'find' | 'create'>('find');
  return (
    <>
      <section className="card clan-hero">
        <h2>{t('clan.heroTitle')}</h2>
        <p>{t('clan.heroText')}</p>
      </section>
      <div className="cx-tabs clan-tabs2" role="tablist">
        {(['find', 'create'] as const).map((x) => (
          <button key={x} type="button" role="tab" aria-selected={tab === x} onClick={() => setTab(x)}>
            {t(`clan.${x}`)}
          </button>
        ))}
      </div>
      {tab === 'find' ? <Browse /> : <CreateForm />}
    </>
  );
}

function Browse() {
  const t = useT();
  const browse = useClan((s) => s.browse);
  const busy = useClan((s) => s.busy);
  const level = useGame((s) => s.save!.player.level);
  const [q, setQ] = useState('');
  const now = useNow(30_000);
  useEffect(() => {
    const id = setTimeout(() => void searchClans(q), 300);
    return () => clearTimeout(id);
  }, [q]);
  const cd = browse?.cooldownUntil && browse.cooldownUntil > now ? browse.cooldownUntil - now : 0;
  return (
    <>
      <input
        className="cx-search"
        type="search"
        value={q}
        placeholder={t('clan.search')}
        onChange={(e) => setQ(e.target.value)}
      />
      {cd > 0 && <p className="clan-warn">{t('clan.cooldown', { time: formatDuration(cd) })}</p>}
      {browse && browse.clans.length === 0 && <p className="screen-sub">{t('clan.noClans')}</p>}
      <div className="clan-list">
        {browse?.clans.map((c) => {
          const requested = browse.requested.includes(c.id);
          const lv = clanLevel(c.xp).level;
          const cap = clanPerks(lv).memberCap;
          const full = c.members >= cap;
          return (
            <article key={c.id} className="card clan-row">
              <ClanEmblem emblem={c.emblem} color={c.color} size={52} />
              <div className="clan-row__main">
                <b>
                  {c.name} <span className="clan-tag">[{c.tag}]</span>
                </b>
                <small>
                  {t('clan.levelN', { n: lv })} · {t('clan.membersN', { n: c.members, cap })} ·{' '}
                  {t('clan.bossLvl', { n: c.bossLevel })}
                </small>
                <small>
                  {t(`clan.mode.${c.joinMode}`)}
                  {c.minLevel > 1 ? ` · ${t('clan.minLevel', { n: c.minLevel })}` : ''}
                </small>
                {c.description && <p>{c.description}</p>}
              </div>
              {requested ? (
                <button
                  type="button"
                  className="btn"
                  disabled={!!busy}
                  onClick={() => void cancelRequestAction(c.id)}
                >
                  {t('clan.cancelApply')}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn--gold"
                  disabled={!!busy || c.joinMode === 'closed' || full || level < c.minLevel || cd > 0}
                  onClick={() => void joinClanAction(c.id)}
                >
                  {c.joinMode === 'closed'
                    ? t('clan.closed')
                    : c.joinMode === 'request'
                      ? t('clan.apply')
                      : t('clan.join')}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}

function CreateForm() {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const busy = useClan((s) => s.busy);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [emblem, setEmblem] = useState<Emblem>('shield');
  const [color, setColor] = useState<string>(CLAN_COLORS[0]);
  const [description, setDescription] = useState('');
  const [joinMode, setJoinMode] = useState<JoinMode>('open');
  const [minLevel, setMinLevel] = useState(1);
  const valid = validateClanName(name) && validateClanTag(tag);
  const can = valid && save.player.level >= CLAN.createMinLevel && save.currencies.gold >= CLAN.createCost;
  return (
    <section className="card clan-form">
      <div className="clan-preview">
        <ClanEmblem emblem={emblem} color={color} size={64} />
        <div>
          <b>
            {name.trim() || t('clan.form.name')}{' '}
            <span className="clan-tag">[{normalizeTag(tag) || '…'}]</span>
          </b>
          <small>{t('clan.form.preview')}</small>
        </div>
      </div>
      <label>
        {t('clan.form.name')}
        <input
          value={name}
          maxLength={CLAN.nameMax}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('clan.form.nameHint')}
        />
      </label>
      <label>
        {t('clan.form.tag')}
        <input value={tag} maxLength={CLAN.tagMax} onChange={(e) => setTag(normalizeTag(e.target.value))} />
      </label>
      <div>
        <span className="clan-lbl">{t('clan.form.emblem')}</span>
        <div className="clan-pick">
          {CLAN_EMBLEMS.map((e) => (
            <button
              key={e}
              type="button"
              aria-pressed={emblem === e}
              onClick={() => setEmblem(e)}
              aria-label={e}
            >
              <ClanEmblem emblem={e} color={color} size={36} />
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="clan-lbl">{t('clan.form.color')}</span>
        <div className="clan-pick">
          {CLAN_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              aria-label={c}
            >
              <i className="clan-swatch" style={{ background: c }} />
            </button>
          ))}
        </div>
      </div>
      <label>
        {t('clan.form.description')}
        <textarea
          value={description}
          maxLength={CLAN.descMax}
          rows={3}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <JoinModeFields mode={joinMode} setMode={setJoinMode} minLevel={minLevel} setMinLevel={setMinLevel} />
      <p className="screen-sub" style={{ margin: 0 }}>
        {t('clan.form.cost', { gold: formatNumber(CLAN.createCost), level: CLAN.createMinLevel })}
      </p>
      {!valid && (name || tag) && <p className="clan-warn">{t('clan.form.invalid')}</p>}
      <button
        type="button"
        className="btn btn--gold"
        disabled={!can || !!busy}
        onClick={() => void createClanAction({ name, tag, emblem, color, description, joinMode, minLevel })}
      >
        {t('clan.form.submit')}
      </button>
    </section>
  );
}

function JoinModeFields(p: {
  mode: JoinMode;
  setMode: (m: JoinMode) => void;
  minLevel: number;
  setMinLevel: (n: number) => void;
}) {
  const t = useT();
  return (
    <>
      <div>
        <span className="clan-lbl">{t('clan.form.joinMode')}</span>
        <div className="chips">
          {(['open', 'request', 'closed'] as const).map((m) => (
            <button key={m} type="button" aria-pressed={p.mode === m} onClick={() => p.setMode(m)}>
              {t(`clan.mode.${m}`)}
            </button>
          ))}
        </div>
        <small className="cx-muted">{t(`clan.modeHint.${p.mode}`)}</small>
      </div>
      <label>
        {t('clan.form.minLevel')}: <b>{p.minLevel}</b>
        <input
          type="range"
          min={1}
          max={60}
          value={p.minLevel}
          onChange={(e) => p.setMinLevel(Number(e.target.value))}
        />
      </label>
    </>
  );
}

// ———————————————————— в клане ————————————————————

function InClan({ st }: { st: ClanState }) {
  const t = useT();
  const [tab, setTab] = useState<Tab>('overview');
  const unread = useClan((s) => s.unread);
  const lv = clanLevel(st.clan.xp);
  const cap = clanPerks(lv.level).memberCap;
  const ready = st.pendingKills.length + (st.yesterday ? 1 : 0);
  useEffect(() => {
    setChatOpen(tab === 'chat');
    return () => setChatOpen(false);
  }, [tab]);
  // После вступления список кланов мог быть прокручен — начинаем с шапки клана.
  useEffect(() => {
    document.querySelector('.app__main')?.scrollTo(0, 0);
  }, [st.clan.id]);
  // Пока экран открыт, раз в 30 секунд обновляем здоровье босса и состав.
  useEffect(() => {
    const id = setInterval(() => void refreshClan(), 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <>
      <section className="card clan-head" style={{ ['--cc' as string]: st.clan.color }}>
        <ClanEmblem emblem={st.clan.emblem} color={st.clan.color} size={64} />
        <div className="clan-head__main">
          <h2>
            {st.clan.name} <span className="clan-tag">[{st.clan.tag}]</span>
          </h2>
          <small>
            {t('clan.levelN', { n: lv.level })} · {t('clan.membersN', { n: st.clan.members, cap })} ·{' '}
            {t(`clan.role.${st.me.role}`)}
          </small>
          <div className="pbar clan-xp">
            <i style={{ width: `${lv.next ? ((st.clan.xp - lv.cur) / (lv.next - lv.cur)) * 100 : 100}%` }} />
          </div>
          <small className="cx-muted">
            {lv.next
              ? t('clan.xpNext', { cur: formatNumber(st.clan.xp), next: formatNumber(lv.next) })
              : t('clan.xpMax')}
          </small>
        </div>
      </section>
      <nav className="clan-tabs" role="tablist">
        {(['overview', 'boss', 'members', 'chat', 'shop'] as Tab[]).map((x) => (
          <button key={x} type="button" role="tab" aria-selected={tab === x} onClick={() => setTab(x)}>
            {t(`clan.tabs.${x}`)}
            {x === 'chat' && unread > 0 && <i className="clan-badge">{unread}</i>}
            {x === 'overview' && ready > 0 && <i className="clan-badge">{ready}</i>}
            {x === 'boss' && st.me.today.keys < CLAN.keysPerDay && <i className="clan-dot" />}
            {x === 'members' && st.requests.length > 0 && <i className="clan-badge">{st.requests.length}</i>}
          </button>
        ))}
      </nav>
      {tab === 'overview' && <Overview st={st} />}
      {tab === 'boss' && <Boss st={st} />}
      {tab === 'members' && <Members st={st} />}
      {tab === 'chat' && <Chat />}
      {tab === 'shop' && <Shop st={st} />}
    </>
  );
}

function Overview({ st }: { st: ClanState }) {
  const t = useT();
  const busy = useClan((s) => s.busy);
  const messages = useClan((s) => s.messages);
  const save = useGame((s) => s.save)!;
  const [leaving, setLeaving] = useState(false);
  const lv = clanLevel(st.clan.xp).level;
  const perks = clanPerks(lv);
  const k = 1 + perks.rewardBonus;
  const events = messages
    .filter((m) => m.kind === 'system')
    .slice(-6)
    .reverse();
  return (
    <>
      {(st.pendingKills.length > 0 || st.yesterday) && (
        <section className="card clan-ready">
          <h3 className="cx-h">{t('clan.rewardsReady')}</h3>
          {st.pendingKills.map((l) => (
            <button
              key={l}
              type="button"
              className="btn btn--gold"
              disabled={!!busy}
              onClick={() => void claimKillAction(l)}
            >
              {t('clan.killRewardBtn', { n: l })}
            </button>
          ))}
          {st.yesterday && (
            <button
              type="button"
              className="btn btn--gold"
              disabled={!!busy}
              onClick={() => void claimRankAction()}
            >
              {t('clan.rankBtn', { rank: st.yesterday.rank, of: st.yesterday.of })}
            </button>
          )}
        </section>
      )}

      <section className="card">
        <h3 className="cx-h">{t('clan.daily')}</h3>
        <div className="clan-daily">
          <div>
            <b>{t('clan.checkin')}</b>
            <small>
              {t('clan.checkinHint', {
                gold: formatNumber(Math.round(CLAN.checkinReward.gold * k)),
                coins: Math.round(CLAN.checkinReward.coins * k),
                xp: CLAN.xp.checkin,
              })}
            </small>
          </div>
          <button
            type="button"
            className="btn btn--gold"
            disabled={st.me.today.checkin || !!busy}
            onClick={() => void checkinAction()}
          >
            {st.me.today.checkin ? '✓ ' + t('clan.checkedIn') : t('clan.checkin')}
          </button>
        </div>
        {DONATIONS.map((d) => {
          const done = st.me.today.donations.includes(d.id);
          const cost = d.cost as { gold?: number; shards?: number };
          const afford =
            (cost.gold ?? 0) <= save.currencies.gold && (cost.shards ?? 0) <= save.currencies.shards;
          return (
            <div className="clan-daily" key={d.id}>
              <div>
                <b>
                  {t('clan.donate')}:{' '}
                  {cost.gold
                    ? t('clan.donateGold', { n: formatNumber(cost.gold) })
                    : t('clan.donateShards', { n: cost.shards ?? 0 })}
                </b>
                <small>{t('clan.donateHint', { xp: d.xp, coins: d.coins })}</small>
              </div>
              <button
                type="button"
                className="btn"
                disabled={done || !afford || !!busy}
                onClick={() => void donateAction(d.id)}
              >
                {done ? '✓ ' + t('clan.donated') : <RewardIcon icon={cost.gold ? 'gold' : 'shards'} />}
              </button>
            </div>
          );
        })}
      </section>

      <section className="card">
        <h3 className="cx-h">{t('clan.weekly')}</h3>
        <p className="cx-muted cx-line">{t('clan.weeklyHint')}</p>
        {WEEKLY_GOALS.map((g) => {
          const have = st.week[g.id];
          const max = g.steps[g.steps.length - 1]!;
          return (
            <div key={g.id} className="clan-goal">
              <div className="clan-goal__top">
                <b>{t(`clan.goal.${g.id}`)}</b>
                <span>
                  {have} / {max}
                </span>
              </div>
              <div className="pbar">
                <i style={{ width: `${Math.min(100, (have / max) * 100)}%` }} />
              </div>
              <div className="clan-steps">
                {g.steps.map((need, i) => {
                  const claimed = st.week.claimed.includes(`${g.id}:${i}`);
                  const r = weeklyReward(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`clan-step${have >= need && !claimed ? ' is-ready' : ''}`}
                      disabled={have < need || claimed || !!busy}
                      onClick={() => void claimWeeklyAction(g.id, i)}
                    >
                      <b>{need}</b>
                      <small>
                        {claimed ? t('clan.claimed') : `${r.coins} 🪙${r.shards ? ` · ${r.shards} 💎` : ''}`}
                      </small>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      <section className="card">
        <h3 className="cx-h">{t('clan.perks')}</h3>
        <p className="cx-line">{t('clan.perkCap', { n: perks.memberCap })}</p>
        <p className="cx-line">{t('clan.perkBonus', { n: Math.round(perks.rewardBonus * 100) })}</p>
        {st.clan.description && <p className="cx-line cx-muted">{st.clan.description}</p>}
      </section>

      <section className="card">
        <h3 className="cx-h">{t('clan.events')}</h3>
        {events.length === 0 ? (
          <p className="cx-muted cx-line">{t('clan.noEvents')}</p>
        ) : (
          <ul className="clan-events">
            {events.map((m) => (
              <li key={m.id}>
                <span>{systemText(m)}</span>
                <time>
                  {new Date(m.at).toLocaleString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button type="button" className="btn btn--danger" onClick={() => setLeaving(true)}>
        {t('clan.leave')}
      </button>
      {leaving && (
        <Confirm
          text={`${t('clan.leaveConfirm')}${st.clan.members <= 1 ? ' ' + t('clan.leaveLast') : ''}`}
          onYes={() => {
            setLeaving(false);
            void leaveClanAction();
          }}
          onNo={() => setLeaving(false)}
        />
      )}
    </>
  );
}

function Confirm({ text, onYes, onNo }: { text: string; onYes: () => void; onNo: () => void }) {
  const t = useT();
  return (
    <div className="sheet-bg" onClick={onNo}>
      <div className="sheet2" onClick={(e) => e.stopPropagation()}>
        <p style={{ margin: 0 }}>{text}</p>
        <div className="acts">
          <button type="button" className="btn" onClick={onNo}>
            {t('clan.cancel')}
          </button>
          <button type="button" className="btn btn--danger" onClick={onYes}>
            {t('clan.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ———————————————————— босс ————————————————————

function Boss({ st }: { st: ClanState }) {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const go = useGame((s) => s.go);
  const updateSave = useGame((s) => s.updateSave);
  const showToast = useGame((s) => s.showToast);
  const busy = useClan((s) => s.busy);
  const now = useNow(1000);
  const element = bossElement(st.boss.day);
  const ec = ELEMENT_COLOR[element];
  const keysLeft = Math.max(0, CLAN.keysPerDay - st.me.today.keys);
  const team = teamHeroes(save);
  const picks = useMemo(() => bossPicks(save, element), [save, element]);
  const myTier = chestTier(st.me.today.damage, st.boss.level);
  const ranking = [...st.members]
    .filter((m) => m.today.damage > 0)
    .sort((a, b) => b.today.damage - a.today.damage);
  const hpPct = (st.boss.hp / st.boss.hpMax) * 100;
  const changeIn = msToNextDay(now);

  return (
    <>
      <section className="card clan-boss" style={{ ['--ec' as string]: ec }}>
        <div className="clan-boss__art">
          <img src={unitArtUrl(`rift_${element}`)} alt={t('clan.bossName')} />
        </div>
        <div className="clan-boss__info">
          <h3>{t('clan.bossTitle', { n: st.boss.level })}</h3>
          <span className="tag" style={{ color: ec }}>
            {t('clan.elementToday')}: {t(`labels.element.${element}`)}
          </span>
          <small className="cx-muted">{t('clan.changesIn', { time: formatDuration(changeIn) })}</small>
          <small className="cx-muted">{t('clan.kills', { n: st.boss.kills })}</small>
        </div>
        <div className="clan-boss__hp">
          <div className="clan-hpbar">
            <i style={{ width: `${hpPct}%` }} />
            <span>
              {formatNumber(st.boss.hp)} / {formatNumber(st.boss.hpMax)}
            </span>
          </div>
          <small className="cx-muted">{t('clan.hp')}</small>
        </div>
      </section>

      <section className="card">
        <div className="clan-keys">
          <div>
            <b>{t('clan.keys')}</b>
            <span className="clan-keydots">
              {Array.from({ length: CLAN.keysPerDay }, (_, i) => (
                <i key={i} className={i < keysLeft ? 'on' : ''} />
              ))}
            </span>
            <small className="cx-muted">
              {keysLeft > 0
                ? t('clan.keysLeft', { n: keysLeft, max: CLAN.keysPerDay })
                : t('clan.keysReset', { time: formatDuration(changeIn) })}
            </small>
          </div>
          <button
            type="button"
            className="btn btn--gold clan-fight"
            disabled={keysLeft === 0 || team.length === 0 || !!busy}
            onClick={() => void startClanBoss()}
          >
            {keysLeft > 0 ? t('clan.fight') : t('clan.noKeys')}
          </button>
        </div>
        <div className="clan-team">
          <span className="cx-muted">
            {t('clan.yourTeam')} · {t('clan.teamPower', { n: formatNumber(teamPower(save)) })}
          </span>
          <div className="clan-team__row">
            {team.map((h) => (
              <img key={h.uid} src={unitArtUrl(heroDef(h.heroId).art)} alt={heroDef(h.heroId).name} />
            ))}
            <button type="button" className="btn" onClick={() => go('team')}>
              {t('clan.changeTeam')}
            </button>
          </div>
        </div>
        {myTier >= 0 && (
          <p className="cx-line">
            {t('clan.yourBest')}: <b>{t(`clan.chests.${CHEST_TIERS[myTier]!.id}`)}</b> ·{' '}
            {formatNumber(st.me.today.damage)}
          </p>
        )}
      </section>

      <section className="card">
        <h3 className="cx-h">{t('clan.advice')}</h3>
        <p className="cx-muted cx-line">{t('clan.adviceHint')}</p>
        <div className="clan-picks">
          {picks.map((p) => {
            const d = heroDef(p.heroId);
            return (
              <div key={p.uid} className="clan-pick-hero">
                <img src={unitArtUrl(d.art)} alt="" style={{ borderColor: ELEMENT_COLOR[d.element] }} />
                <b>{d.name}</b>
                <small>
                  {p.reasons
                    .filter((r) => r !== 'weak')
                    .slice(0, 2)
                    .map((r) => (r === 'strong' ? t(`labels.element.${d.element}`) : t(`tags.${r}`)))
                    .join(', ') || formatNumber(p.score)}
                </small>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          className="btn"
          disabled={picks.length === 0}
          onClick={() => {
            updateSave((s) =>
              setTeam(
                s,
                picks.map((p) => p.uid),
              ),
            );
            showToast(t('clan.adviceApplied'));
            platform().haptics.notify('success');
          }}
        >
          {t('clan.useAdvice')}
        </button>
      </section>

      <section className="card">
        <h3 className="cx-h">{t('clan.mechanics')}</h3>
        <ul className="clan-mech">
          <li>{t('clan.mech.shared')}</li>
          <li>{t('clan.mech.turns', { n: CLAN.bossTurns })}</li>
          <li>{t('clan.mech.enrage', { n: Math.round(CLAN.enrage * 100) })}</li>
          <li>{t('clan.mech.immune')}</li>
          <li>{t('clan.mech.element')}</li>
        </ul>
        <h3 className="cx-h" style={{ marginTop: 10 }}>
          {t('clan.skills')}
        </h3>
        {CLAN_BOSS_SKILLS.map((s) => (
          <div className="skill" key={s.id}>
            <span className="skill__ic">
              <SkillIcon skill={s} color={ec ?? '#fff'} />
            </span>
            <div>
              <b>{s.name}</b>
              <small>{s.cooldown ? t('heroes.cooldown', { n: s.cooldown }) : t('heroes.noCooldown')}</small>
              <p>{s.desc}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="card">
        <h3 className="cx-h">{t('clan.chestsTitle')}</h3>
        <p className="cx-muted cx-line">{t('clan.chestsHint')}</p>
        <div className="clan-chests">
          {CHEST_TIERS.map((c, i) => (
            <div key={c.id} className={`clan-chest t${i}${i === myTier ? ' is-mine' : ''}`}>
              <b>{t(`clan.chests.${c.id}`)}</b>
              <small>
                {i === 0
                  ? '> 0'
                  : t('clan.chestFrom', { n: formatNumber(Math.ceil(c.share * bossHp(st.boss.level))) })}
              </small>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h3 className="cx-h">{t('clan.today')}</h3>
        {ranking.length === 0 ? (
          <p className="cx-muted cx-line">{t('clan.nobody')}</p>
        ) : (
          <ol className="clan-rank">
            {ranking.map((m) => (
              <li key={m.profile.id}>
                <img src={unitArtUrl(m.profile.avatar)} alt="" />
                <span>{m.profile.nickname}</span>
                <span className="clan-keydots sm">
                  {Array.from({ length: CLAN.keysPerDay }, (_, i) => (
                    <i key={i} className={i < m.today.keys ? 'on' : ''} />
                  ))}
                </span>
                <b>{formatNumber(m.today.damage)}</b>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

// ———————————————————— состав ————————————————————

function Members({ st }: { st: ClanState }) {
  const t = useT();
  const busy = useClan((s) => s.busy);
  const me = useOnline((s) => s.userId);
  const now = useNow(60_000);
  const [menu, setMenu] = useState<ClanMemberInfo | null>(null);
  const [confirm, setConfirm] = useState<{ text: string; run: () => void } | null>(null);
  const canManage = st.me.role !== 'member';
  return (
    <>
      {canManage && (
        <section className="card">
          <h3 className="cx-h">{t('clan.requests')}</h3>
          {st.requests.length === 0 ? (
            <p className="cx-muted cx-line">{t('clan.noRequests')}</p>
          ) : (
            st.requests.map((r) => (
              <div key={r.profile.id} className="clan-member">
                <img src={unitArtUrl(r.profile.avatar)} alt="" />
                <div>
                  <b>{r.profile.nickname}</b>
                  <small>
                    {t('clan.levelN', { n: r.profile.level })} ·{' '}
                    {t('heroes.power', { n: formatNumber(r.profile.power) })}
                  </small>
                </div>
                <div className="clan-member__acts">
                  <button
                    type="button"
                    className="btn btn--gold"
                    disabled={!!busy}
                    onClick={() => void respondAction(r.profile.id, true)}
                  >
                    {t('clan.accept')}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={!!busy}
                    onClick={() => void respondAction(r.profile.id, false)}
                  >
                    {t('clan.decline')}
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      <section className="card">
        <h3 className="cx-h">
          {t('clan.members')} · {st.members.length}
        </h3>
        {st.members.map((m) => {
          const on = isOnline(m.profile, now) || m.profile.id === me;
          const manageable =
            m.profile.id !== me &&
            (st.me.role === 'leader' || (st.me.role === 'officer' && m.role === 'member'));
          return (
            <div key={m.profile.id} className="clan-member">
              <span className="clan-ava">
                <img src={unitArtUrl(m.profile.avatar)} alt="" />
                {on && <i title={t('clan.online')} />}
              </span>
              <div>
                <b>
                  {m.profile.nickname}
                  {m.role !== 'member' && (
                    <span className={`clan-role r-${m.role}`}>{t(`clan.role.${m.role}`)}</span>
                  )}
                </b>
                <small>
                  {t('clan.levelN', { n: m.profile.level })} ·{' '}
                  {t('heroes.power', { n: formatNumber(m.profile.power) })} ·{' '}
                  {t('clan.contribution', { n: formatNumber(m.contribution) })}
                </small>
                <small className="clan-today">
                  <span className="clan-keydots sm">
                    {Array.from({ length: CLAN.keysPerDay }, (_, i) => (
                      <i key={i} className={i < m.today.keys ? 'on' : ''} />
                    ))}
                  </span>
                  {m.today.checkin && <span>✓ {t('clan.memberCheckin')}</span>}
                  {m.today.damage > 0 && <span>⚔ {formatNumber(m.today.damage)}</span>}
                </small>
              </div>
              {manageable && (
                <button type="button" className="btn clan-more" onClick={() => setMenu(m)} aria-label="…">
                  ⋯
                </button>
              )}
            </div>
          );
        })}
      </section>

      {canManage && <ClanSettings info={st.clan} />}

      {menu && (
        <div className="sheet-bg" onClick={() => setMenu(null)}>
          <div className="sheet2" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 18 }}>{menu.profile.nickname}</h3>
            {st.me.role === 'leader' && (
              <>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    void setRoleAction(menu.profile.id, menu.role === 'officer' ? 'member' : 'officer');
                    setMenu(null);
                  }}
                >
                  {menu.role === 'officer' ? t('clan.demote') : t('clan.promote')}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const m = menu;
                    setMenu(null);
                    setConfirm({
                      text: t('clan.transferConfirm', { name: m.profile.nickname }),
                      run: () => void transferAction(m.profile.id),
                    });
                  }}
                >
                  {t('clan.transfer')}
                </button>
              </>
            )}
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                const m = menu;
                setMenu(null);
                setConfirm({
                  text: t('clan.kickConfirm', { name: m.profile.nickname }),
                  run: () => void kickAction(m.profile.id),
                });
              }}
            >
              {t('clan.kick')}
            </button>
          </div>
        </div>
      )}
      {confirm && (
        <Confirm
          text={confirm.text}
          onNo={() => setConfirm(null)}
          onYes={() => {
            confirm.run();
            setConfirm(null);
          }}
        />
      )}
    </>
  );
}

function ClanSettings({ info }: { info: ClanInfo }) {
  const t = useT();
  const busy = useClan((s) => s.busy);
  const showToast = useGame((s) => s.showToast);
  const [description, setDescription] = useState(info.description);
  const [joinMode, setJoinMode] = useState<JoinMode>(info.joinMode);
  const [minLevel, setMinLevel] = useState(info.minLevel);
  const [emblem, setEmblem] = useState(info.emblem);
  const [color, setColor] = useState(info.color);
  return (
    <section className="card clan-form">
      <h3 className="cx-h">{t('clan.settings')}</h3>
      <div className="clan-pick">
        {CLAN_EMBLEMS.map((e) => (
          <button
            key={e}
            type="button"
            aria-pressed={emblem === e}
            onClick={() => setEmblem(e)}
            aria-label={e}
          >
            <ClanEmblem emblem={e} color={color} size={32} />
          </button>
        ))}
      </div>
      <div className="clan-pick">
        {CLAN_COLORS.map((c) => (
          <button key={c} type="button" aria-pressed={color === c} onClick={() => setColor(c)} aria-label={c}>
            <i className="clan-swatch" style={{ background: c }} />
          </button>
        ))}
      </div>
      <label>
        {t('clan.form.description')}
        <textarea
          value={description}
          maxLength={CLAN.descMax}
          rows={3}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <JoinModeFields mode={joinMode} setMode={setJoinMode} minLevel={minLevel} setMinLevel={setMinLevel} />
      <button
        type="button"
        className="btn btn--gold"
        disabled={!!busy}
        onClick={() =>
          void updateClanAction({ description, joinMode, minLevel, emblem, color }).then(() =>
            showToast(t('clan.saved')),
          )
        }
      >
        {t('clan.save')}
      </button>
    </section>
  );
}

// ———————————————————— чат ————————————————————

function Chat() {
  const t = useT();
  const messages = useClan((s) => s.messages);
  const me = useOnline((s) => s.userId);
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);
  const send = () => {
    const v = text.trim();
    if (!v) return;
    setText('');
    void sendClanMessageAction(v);
  };
  return (
    <section className="card clan-chat">
      <div className="clan-chat__list">
        {messages.length === 0 && <p className="cx-muted cx-line">{t('clan.chatEmpty')}</p>}
        {messages.map((m) =>
          m.kind === 'system' ? (
            <p key={m.id} className="clan-msg is-sys">
              {systemText(m)}
            </p>
          ) : (
            <div key={m.id} className={`clan-msg${m.from === me ? ' is-me' : ''}`}>
              {m.from !== me && <b>{m.nickname ?? '?'}</b>}
              <span>{m.body}</span>
              <time>
                {new Date(m.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              </time>
            </div>
          ),
        )}
        <div ref={end} />
      </div>
      <form
        className="clan-chat__input"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          value={text}
          maxLength={500}
          placeholder={t('clan.chatPlaceholder')}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn btn--gold" disabled={!text.trim()}>
          {t('clan.send')}
        </button>
      </form>
    </section>
  );
}

// ———————————————————— магазин ————————————————————

const SHOP_MATERIAL: Record<string, MaterialId> = {
  tome: 'xpTome',
  ore: 'ore',
  dust: 'starDust',
  scroll: 'scroll',
  stone: 'awakenStone',
  ancientScroll: 'ancientScroll',
  factionScroll: 'factionScroll',
  voidScroll: 'voidScroll',
  goldScroll: 'goldScroll',
  skillBook: 'skillBook',
};

function Shop({ st }: { st: ClanState }) {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const updateSave = useGame((s) => s.updateSave);
  const showToast = useGame((s) => s.showToast);
  const now = useNow(60_000);
  const lv = clanLevel(st.clan.xp).level;
  const buy = (id: string) => {
    let out: ReturnType<typeof buyClanOffer> = 'level';
    updateSave((s) => {
      out = buyClanOffer(s, id, lv, now);
    });
    const res = out as ReturnType<typeof buyClanOffer>;
    if (typeof res === 'string') {
      showToast(t(`clan.err.${res as ClanBuyError}`));
      platform().haptics.notify('warning');
      return;
    }
    const o = CLAN_SHOP.find((x) => x.id === id)!;
    useClan.setState({ popup: { title: t(`clan.shop.${id}`), lines: rewardLines(o.reward, res.item) } });
    platform().audio.play('reward');
  };
  return (
    <>
      <section className="card clan-coins">
        <RewardIcon icon="coin" />
        <div>
          <b>{formatNumber(save.clan.coins)}</b>
          <small>{t('clan.coins')}</small>
        </div>
      </section>
      <p className="cx-muted cx-line">{t('clan.shopHint')}</p>
      <div className="clan-shop">
        {CLAN_SHOP.map((o) => {
          const n = clanShopBought(save, o.id, now);
          const locked = lv < o.minLevel;
          const soldOut = n >= o.limit;
          return (
            <article key={o.id} className={`card clan-offer${locked ? ' is-locked' : ''}`}>
              <span className="clan-offer__ic">
                {SHOP_MATERIAL[o.icon] ? (
                  <MaterialIcon id={SHOP_MATERIAL[o.icon]!} />
                ) : (
                  <RewardIcon icon={o.icon === 'item' ? 'item' : o.icon === 'energy' ? 'energy' : 'shards'} />
                )}
              </span>
              <b>{t(`clan.shop.${o.id}`)}</b>
              <small>
                {locked
                  ? t('clan.needLevel', { n: o.minLevel })
                  : t('clan.left', { n: o.limit - n, max: o.limit })}
              </small>
              <button
                type="button"
                className="btn btn--gold"
                disabled={locked || soldOut || save.clan.coins < o.price}
                onClick={() => buy(o.id)}
              >
                {soldOut ? t('clan.soldOut') : t('clan.price', { n: formatNumber(o.price) })}
              </button>
            </article>
          );
        })}
      </div>
    </>
  );
}
