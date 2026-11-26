import { heroDef } from '@/content';
import { FUSIONS, fuse, fusionPick } from '@/game';
import { formatNumber, useT } from '@/i18n';
import { useGame } from '@/state/store';
import { platform } from '@/state/services';
import { unitStillUrl } from '@/assets/art';
import { IconGold } from '../components/icons';
import '../components/depth.css';
import './screens.css';

/** Слияние: четыре героя фракции превращаются в особого героя, которого нет в призыве. */
export default function FusionScreen() {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const updateSave = useGame((s) => s.updateSave);
  const showToast = useGame((s) => s.showToast);
  return (
    <>
      <h2 className="screen-title">{t('fusion.title')}</h2>
      <p className="screen-sub">{t('fusion.hint')}</p>
      {FUSIONS.map((r) => {
        const d = heroDef(r.result);
        const picks = r.parts.map((p) => fusionPick(save, p.heroId, p.stars));
        const ready = picks.every(Boolean) && save.currencies.gold >= r.gold;
        return (
          <section key={r.result} className="card fu-card">
            <div className="fu-head">
              <img src={unitStillUrl(d.art)} alt="" />
              <div>
                <b>
                  {d.name} · {d.title}
                </b>
                <small>
                  {t(`labels.rarity.${d.rarity}`)} · {t(`labels.element.${d.element}`)} ·{' '}
                  {t(`labels.role.${d.role}`)} · {'★'.repeat(r.stars)}
                </small>
              </div>
            </div>
            <div className="fu-parts">
              {r.parts.map((p, i) => {
                const pd = heroDef(p.heroId);
                return (
                  <div key={p.heroId} className={`fu-part${picks[i] ? ' is-ok' : ''}`}>
                    <img src={unitStillUrl(pd.art)} alt="" />
                    <span>{pd.name}</span>
                    <em>{t('fusion.need', { n: p.stars })}</em>
                  </div>
                );
              })}
            </div>
            <p className="screen-sub" style={{ margin: 0 }}>
              {t('fusion.consumed')}
            </p>
            <button
              type="button"
              className="btn btn--gold"
              disabled={!ready}
              onClick={() => {
                let res: ReturnType<typeof fuse> = 'notFound';
                updateSave((s) => {
                  res = fuse(s, r.result);
                });
                const out = res as ReturnType<typeof fuse>;
                if (typeof out === 'string') {
                  showToast(t(`fusion.err.${out}`));
                  return;
                }
                showToast(t('fusion.done', { name: d.name }));
                platform().audio.play('victory');
                platform().haptics.notify('success');
              }}
            >
              {t('fusion.go')} · <IconGold /> {formatNumber(r.gold)}
            </button>
          </section>
        );
      })}
    </>
  );
}
