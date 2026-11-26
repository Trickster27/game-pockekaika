import { SHOP_OFFERS, boughtCount, buyOffer, type ShopOffer } from '@/game';
import { formatNumber, useT } from '@/i18n';
import { useGame } from '@/state/store';
import { platform } from '@/state/services';
import { IconEnergy, IconGold, IconShard } from '../components/icons';
import { MaterialIcon } from '../components/MaterialIcon';
import { useNow } from '../hooks';
import './screens.css';
import './summon.css';

function OfferIcon({ icon }: { icon: ShopOffer['icon'] }) {
  switch (icon) {
    case 'energy':
      return <IconEnergy />;
    case 'gold':
      return <IconGold />;
    case 'scroll':
      return <MaterialIcon id="scroll" />;
    case 'tome':
      return <MaterialIcon id="xpTome" />;
    case 'dust':
      return <MaterialIcon id="starDust" />;
    case 'stone':
      return <MaterialIcon id="awakenStone" />;
    case 'ancientScroll':
    case 'factionScroll':
    case 'voidScroll':
    case 'goldScroll':
    case 'skillBook':
      return <MaterialIcon id={icon} />;
    default:
      return <IconShard />;
  }
}

export default function ShopScreen() {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const updateSave = useGame((s) => s.updateSave);
  const showToast = useGame((s) => s.showToast);
  const now = useNow(30_000);
  const buy = (o: ShopOffer) => {
    const out: { r: ReturnType<typeof buyOffer> } = { r: 'soldOut' };
    updateSave((s) => {
      out.r = buyOffer(s, o.id, Date.now());
    });
    const r = out.r;
    if (r === true) {
      platform().audio.play('reward');
      platform().haptics.notify('success');
      showToast(t('shop.bought'));
    } else {
      showToast(t(`shop.err.${r}`));
      platform().haptics.notify('warning');
    }
  };
  return (
    <>
      <h2 className="screen-title">{t('shop.title')}</h2>
      <p className="screen-sub">
        {t('shop.subtitle')} · {t('shop.resetDay')}
      </p>
      <div className="offers">
        {SHOP_OFFERS.map((o) => {
          const real = o.price.kind === 'real';
          const left = o.limit ? o.limit.count - boughtCount(save, o, now) : null;
          return (
            <section key={o.id} className={`offer${real ? ' offer--real' : ''}`}>
              <span className="offer__ic">
                <OfferIcon icon={o.icon} />
              </span>
              <b>{o.name}</b>
              <p>{o.desc}</p>
              {left !== null && <small>{left > 0 ? t('shop.left', { n: left }) : t('shop.soldOut')}</small>}
              {real ? (
                <>
                  <small>{t('shop.realHint')}</small>
                  <button type="button" className="btn" disabled>
                    {t('shop.soon')}
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn--gold" disabled={left === 0} onClick={() => buy(o)}>
                  {o.price.kind === 'gold' ? <IconGold /> : <IconShard />}{' '}
                  {formatNumber(o.price.kind === 'gold' || o.price.kind === 'shards' ? o.price.amount : 0)}
                </button>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
