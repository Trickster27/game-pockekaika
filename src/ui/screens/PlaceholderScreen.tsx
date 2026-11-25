import { useT } from '@/i18n';
import { useGame } from '@/state/store';
import { IconCrystal } from '../components/icons';
import './screens.css';

export default function PlaceholderScreen(props: { titleKey?: string; stage?: number }) {
  const t = useT();
  const ph = useGame((s) => s.placeholder);
  const go = useGame((s) => s.go);
  const titleKey = props.titleKey ?? ph?.titleKey ?? 'app.title';
  const stage = props.stage ?? ph?.stage ?? 2;
  return (
    <div className="ph">
      <IconCrystal />
      <h2 className="screen-title">{t(titleKey)}</h2>
      <p>{t('app.comingIn', { stage })}</p>
      <button type="button" className="btn" onClick={() => go('camp')}>
        {t('nav.camp')}
      </button>
    </div>
  );
}
