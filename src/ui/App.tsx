import { lazy, Suspense, useEffect } from 'react';
import { useT } from '@/i18n';
import { useGame } from '@/state/store';
import { TopBar } from './components/TopBar';
import { BottomNav } from './components/BottomNav';
import { IconCrystal } from './components/icons';
import { IdleModal } from './components/IdleModal';
import './screens/battle.css';
import './screens/summon.css';
import './app.css';

// Экраны грузятся лениво: первый экран (лагерь) приходит быстро, остальные — по требованию.
const CampScreen = lazy(() => import('./screens/CampScreen'));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen'));
const BattleScreen = lazy(() => import('./screens/BattleScreen'));
const CampaignScreen = lazy(() => import('./screens/CampaignScreen'));
const HeroesScreen = lazy(() => import('./screens/HeroesScreen'));
const TeamScreen = lazy(() => import('./screens/TeamScreen'));
const SummonScreen = lazy(() => import('./screens/SummonScreen'));
const ShopScreen = lazy(() => import('./screens/ShopScreen'));
const BagScreen = lazy(() => import('./screens/BagScreen'));
const DungeonsScreen = lazy(() => import('./screens/DungeonsScreen'));
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
      return <HeroesScreen />;
    case 'team':
      return <TeamScreen />;
    case 'summon':
      return <SummonScreen />;
    case 'shop':
      return <ShopScreen />;
    case 'bag':
      return <BagScreen />;
    case 'dungeons':
      return <DungeonsScreen />;
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
      {!full && <IdleModal />}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
