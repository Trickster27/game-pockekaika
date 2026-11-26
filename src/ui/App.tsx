import { lazy, Suspense, useEffect } from 'react';
import { useOnline } from '@/state/online';
import { refreshClan } from '@/state/clan';
import { SummaryModal } from './components/SummaryModal';
import { Tutorial } from './Tutorial';
import { useT } from '@/i18n';
import { useGame } from '@/state/store';
import { TopBar } from './components/TopBar';
import { BottomNav } from './components/BottomNav';
import { IconCrystal } from './components/icons';
import { IdleModal } from './components/IdleModal';
import { ConflictModal } from './components/ConflictModal';
import './screens/battle.css';
import './screens/summon.css';
import './app.css';

// Экраны грузятся лениво: первый экран (лагерь) приходит быстро, остальные — по требованию.
const CampScreen = lazy(() => import('./screens/CampScreen'));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen'));
const BattleScreen = lazy(() => import('./screens/BattleScreen'));
const CampaignScreen = lazy(() => import('./screens/CampaignScreen'));
const HeroesScreen = lazy(() => import('./screens/HeroesScreen'));
const CodexScreen = lazy(() => import('./screens/CodexScreen'));
const TeamScreen = lazy(() => import('./screens/TeamScreen'));
const SummonScreen = lazy(() => import('./screens/SummonScreen'));
const ShopScreen = lazy(() => import('./screens/ShopScreen'));
const BagScreen = lazy(() => import('./screens/BagScreen'));
const DungeonsScreen = lazy(() => import('./screens/DungeonsScreen'));
const TowerScreen = lazy(() => import('./screens/TowerScreen'));
const ArenaScreen = lazy(() => import('./screens/ArenaScreen'));
const QuestsScreen = lazy(() => import('./screens/QuestsScreen'));
const AccountScreen = lazy(() => import('./screens/AccountScreen'));
const FriendsScreen = lazy(() => import('./screens/FriendsScreen'));
const ClanScreen = lazy(() => import('./screens/ClanScreen'));
const TrainingScreen = lazy(() => import('./screens/TrainingScreen'));
const ExpeditionsScreen = lazy(() => import('./screens/ExpeditionsScreen'));
const RaidScreen = lazy(() => import('./screens/RaidScreen'));
const LeadersScreen = lazy(() => import('./screens/LeadersScreen'));
const FusionScreen = lazy(() => import('./screens/FusionScreen'));
const EventsScreen = lazy(() => import('./screens/EventsScreen'));
const ChatScreen = lazy(() => import('./screens/ChatScreen'));
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
    case 'codex':
      return <CodexScreen />;
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
    case 'tower':
      return <TowerScreen />;
    case 'arena':
      return <ArenaScreen />;
    case 'quests':
      return <QuestsScreen />;
    case 'account':
      return <AccountScreen />;
    case 'events':
      return <EventsScreen />;
    case 'fusion':
      return <FusionScreen />;
    case 'leaders':
      return <LeadersScreen />;
    case 'training':
      return <TrainingScreen />;
    case 'expeditions':
      return <ExpeditionsScreen />;
    case 'raid':
      return <RaidScreen />;
    case 'clan':
      return <ClanScreen />;
    case 'friends':
      return <FriendsScreen />;
    case 'chat':
      return <ChatScreen />;
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

  // Клан подгружается после входа: нужен для отметок на карте лагеря и наград.
  const userId = useOnline((s) => s.userId);
  useEffect(() => {
    if (userId) void refreshClan();
  }, [userId]);

  if (!ready) {
    return (
      <div className="app">
        <div />
        <Splash />
        <div />
      </div>
    );
  }
  const full = screen === 'battle' || screen === 'chat';
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
      <ConflictModal />
      <SummaryModal />
      <Tutorial />
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
