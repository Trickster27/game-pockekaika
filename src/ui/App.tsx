import { lazy, Suspense, useEffect } from 'react';
import { useT } from '@/i18n';
import { useGame } from '@/state/store';
import { TopBar } from './components/TopBar';
import { BottomNav } from './components/BottomNav';
import { IconCrystal } from './components/icons';
import './app.css';

// Экраны грузятся лениво: первый экран (лагерь) приходит быстро, остальные — по требованию.
const CampScreen = lazy(() => import('./screens/CampScreen'));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen'));
const BattleScreen = lazy(() => import('./screens/BattleScreen'));
const CampaignScreen = lazy(() => import('./screens/CampaignScreen'));
const PlaceholderScreen = lazy(() => import('./screens/PlaceholderScreen'));

function Splash() {
  const t = useT();
  return (
    <div className="splash">
      <IconCrystal />
      <span>{t('app.loading')}</span>
    </div>
  );
}

function Screen() {
  const screen = useGame((s) => s.screen);
  switch (screen) {
    case 'camp':
      return <CampScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'battle':
      return <BattleScreen />;
    case 'campaign':
      return <CampaignScreen />;
    case 'heroes':
      return <PlaceholderScreen titleKey="nav.heroes" stage={4} />;
    case 'team':
      return <PlaceholderScreen titleKey="nav.team" stage={4} />;
    case 'summon':
      return <PlaceholderScreen titleKey="nav.summon" stage={5} />;
    case 'bag':
      return <PlaceholderScreen titleKey="nav.bag" stage={6} />;
    case 'placeholder':
      return <PlaceholderScreen />;
  }
}

export function App() {
  const t = useT();
  const ready = useGame((s) => s.ready);
  const screen = useGame((s) => s.screen);
  const loadSource = useGame((s) => s.loadSource);
  const toast = useGame((s) => s.toast);
  const showToast = useGame((s) => s.showToast);

  useEffect(() => {
    if (loadSource === 'backup') showToast(t('app.loadFromBackup'));
  }, [loadSource, showToast, t]);

  if (!ready) {
    return (
      <div className="app">
        <div />
        <Splash />
        <div />
      </div>
    );
  }
  const full = screen === 'battle';
  return (
    <div className="app">
      {full ? <div /> : <TopBar />}
      <main className={full ? 'app__main app__main--full' : 'app__main'}>
        <Suspense fallback={<Splash />}>
          <Screen />
        </Suspense>
      </main>
      {full ? <div /> : <BottomNav />}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
