import type { HeroDef } from '@/core/content';
import type { OwnedHero } from '@/save/schema';
import { unitArtUrl } from '@/assets/art';
import { useT } from '@/i18n';
import { ELEMENT_COLOR, FACTION_COLOR, RARITY_COLOR } from '../colors';

export function Stars({ n, awakened }: { n: number; awakened?: boolean }) {
  return (
    <span className={`stars-row${awakened ? ' is-aw' : ''}`} aria-label={`${n}★`}>
      {Array.from({ length: n }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2 L14.6 9 L22 9 L16 13.5 L18.3 21 L12 16.5 L5.7 21 L8 13.5 L2 9 L9.4 9 Z" />
        </svg>
      ))}
    </span>
  );
}

/** Плитка героя для списков. */
export function HeroTile(props: {
  def: HeroDef;
  owned?: OwnedHero;
  inTeam?: boolean;
  selected?: boolean;
  dim?: boolean;
  onClick?: () => void;
}) {
  const t = useT();
  const { def, owned } = props;
  return (
    <button
      type="button"
      className={`htile${props.selected ? ' is-sel' : ''}${props.dim || !owned ? ' is-dim' : ''}`}
      style={{ ['--rc' as string]: RARITY_COLOR[def.rarity], ['--fc' as string]: FACTION_COLOR[def.faction] }}
      onClick={props.onClick}
      aria-label={def.name}
    >
      <span className="htile__art">
        <img src={unitArtUrl(def.art)} alt="" loading="lazy" />
      </span>
      <span
        className="htile__el"
        style={{ ['--ec' as string]: ELEMENT_COLOR[def.element] }}
        title={t(`labels.element.${def.element}`)}
      />
      {owned && <span className="htile__lvl">{owned.level}</span>}
      {props.inTeam && <span className="htile__team">✓</span>}
      <span className="htile__name">{def.name}</span>
      {owned ? (
        <Stars n={owned.stars} awakened={owned.awakened} />
      ) : (
        <span className="htile__no">{t('heroes.notOwned')}</span>
      )}
    </button>
  );
}
