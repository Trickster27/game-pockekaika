import { MATERIAL_IDS } from '@/save/schema';
import { formatNumber, useT } from '@/i18n';
import { useGame } from '@/state/store';
import { MaterialIcon } from '../components/MaterialIcon';
import './screens.css';
import './summon.css';

export default function BagScreen() {
  const t = useT();
  const save = useGame((s) => s.save)!;
  return (
    <>
      <h2 className="screen-title">{t('nav.bag')}</h2>
      <p className="screen-sub">{t('bag.materials')}</p>
      <div className="mats">
        {MATERIAL_IDS.map((id) => (
          <div className="mat" key={id}>
            <MaterialIcon id={id} />
            <div>
              <b>{formatNumber(save.materials[id])}</b>
              <span>{t(`labels.material.${id}`)}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
