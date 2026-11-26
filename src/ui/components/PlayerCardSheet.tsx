import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { heroDef } from '@/content';
import { leagueOf } from '@/game';
import type { PlayerCard } from '@/online';
import { formatNumber, useT } from '@/i18n';
import { errorText, onlineBackend, useOnline } from '@/state/online';
import { useGame } from '@/state/store';
import { unitArtUrl } from '@/assets/art';
import { RARITY_COLOR } from '../colors';
import './social.css';

/** Карточка игрока: уровень, сила, башня, рейтинг арены, коллекция, клан и защитная команда. */
export function PlayerCardSheet({ userId, onClose }: { userId: string; onClose: () => void }) {
  const t = useT();
  const [card, setCard] = useState<PlayerCard | null>(null);
  const me = useOnline((s) => s.userId);
  useEffect(() => {
    let alive = true;
    onlineBackend()
      ?.playerCard(userId)
      .then((c) => alive && setCard(c))
      .catch((e) => useGame.getState().showToast(errorText(e)));
    return () => {
      alive = false;
    };
  }, [userId]);
  const lg = card ? leagueOf(card.pvpRating) : null;
  return createPortal(
    <div className="soc-bg" onClick={onClose}>
      <div className="soc-sheet" onClick={(e) => e.stopPropagation()}>
        {!card ? (
          <p className="screen-sub">{t('social.loading')}</p>
        ) : (
          <>
            <div className="pc-head">
              <img src={unitArtUrl(card.profile.avatar)} alt="" />
              <div>
                <b>
                  {card.profile.nickname}
                  {card.clanTag && <span className="clan-tag"> [{card.clanTag}]</span>}
                  {card.profile.id === me && <small> · {t('social.you')}</small>}
                </b>
                <small>
                  {t('social.level', { n: card.level })}
                  {card.clanName ? ` · ${card.clanName}` : ''}
                </small>
              </div>
            </div>
            <div className="pc-stats">
              <div>
                <span>{t('social.kind.power')}</span>
                <b>{formatNumber(card.power)}</b>
              </div>
              <div>
                <span>{t('social.kind.pvp')}</span>
                <b style={{ color: lg?.color }}>
                  {card.pvpRating} · {lg?.name}
                </b>
              </div>
              <div>
                <span>{t('social.kind.tower')}</span>
                <b>{card.tower}</b>
              </div>
              <div>
                <span>{t('social.kind.collection')}</span>
                <b>{card.collection}</b>
              </div>
            </div>
            <h4 className="pc-h">{t('social.defense')}</h4>
            <div className="pc-team">
              {card.team.length === 0 && <p className="screen-sub">{t('social.noDefense')}</p>}
              {card.team.map((u, i) => {
                const d = heroDef(u.defId);
                return (
                  <div key={i} className="pc-hero">
                    <img src={unitArtUrl(d.art)} alt="" style={{ borderColor: RARITY_COLOR[d.rarity] }} />
                    <b>{d.name}</b>
                    <small>
                      {u.level} ур. · {'★'.repeat(u.stars)}
                    </small>
                  </div>
                );
              })}
            </div>
            <button type="button" className="btn" onClick={onClose}>
              {t('social.close')}
            </button>
          </>
        )}
      </div>
    </div>,
    document.querySelector('.app') ?? document.body,
  );
}
