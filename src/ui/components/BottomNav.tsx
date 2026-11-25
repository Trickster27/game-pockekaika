import type { ReactNode } from 'react';
import { useT } from '@/i18n';
import { useGame, type ScreenId } from '@/state/store';
import { platform } from '@/state/services';
import { useBadges } from '../badges';
import { IconBag, IconCamp, IconHeroes, IconSummon, IconTeam } from './icons';

const ITEMS: { id: ScreenId; label: string; icon: ReactNode }[] = [
  { id: 'camp', label: 'nav.camp', icon: <IconCamp /> },
  { id: 'heroes', label: 'nav.heroes', icon: <IconHeroes /> },
  { id: 'team', label: 'nav.team', icon: <IconTeam /> },
  { id: 'summon', label: 'nav.summon', icon: <IconSummon /> },
  { id: 'bag', label: 'nav.bag', icon: <IconBag /> },
];

export function BottomNav() {
  const t = useT();
  const screen = useGame((s) => s.screen);
  const go = useGame((s) => s.go);
  const badges = useBadges();
  const dot: Partial<Record<ScreenId, boolean>> = {
    camp: badges?.camp,
    heroes: badges?.heroes,
    team: badges?.team,
    summon: badges?.summon,
  };
  return (
    <nav className="nav" aria-label={t('app.title')}>
      {ITEMS.map((it) => (
        <button
          key={it.id}
          type="button"
          className={screen === it.id ? 'is-on' : undefined}
          data-tut={`nav-${it.id}`}
          aria-current={screen === it.id ? 'page' : undefined}
          onClick={() => {
            platform().haptics.impact('light');
            platform().audio.play('tap');
            go(it.id);
          }}
        >
          <span className="nav__ic">
            {it.icon}
            {dot[it.id] && screen !== it.id && <i className="nav__dot" />}
          </span>
          {t(it.label)}
        </button>
      ))}
    </nav>
  );
}
