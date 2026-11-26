import { lazy, Suspense, useEffect } from 'react';
import { useOnline } from '@/state/online';
import { refreshClan } from '@/state/clan';
import { SummaryModal } from './components/SummaryModal';
import { StoryOverlay } from './components/StoryOverlay';
import { Tutorial } from './Tutorial';
import { useT } from '@/i18n';
import { useGame } from '@/state/store';
import { services } from '@/state/services';
import { TopBar } from './components/TopBar';
import { BottomNav } from './components/BottomNav';
import { IconCrystal } from './components/icons';
import { IdleModal } from './components/IdleModal';
import { ConflictModal } from './components/ConflictModal';
import './screens/battle.css';
import './screens/summon.css';
import './app.css';
import './theme.css';

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
const MailScreen = lazy(() => import('./screens/MailScreen'));
const TrialScreen = lazy(() => import('./screens/TrialScreen'));
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

/** Та же заставка, что в index.html (стили там же): без скачка между HTML и React. */
function BootSplash() {
  const t = useT();
  return (
    <div className="boot">
      <svg className="boot__gem" viewBox="0 0 120 180" aria-hidden="true">
        <path
          d="M60 6 L10 80 L60 174 L110 80 Z"
          fill="#f0c860"
          stroke="#0a0710"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <path d="M60 6 L10 80 L60 80 Z" fill="#fff4c8" opacity=".7" />
      </svg>
      <h1 className="boot__title">{t('app.title')}</h1>
      <p className="boot__sub">{t('app.tagline')}</p>
      <div className="boot__bar">
        <i />
      </div>
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
    case 'mail':
      return <MailScreen />;
    case 'trial':
      return <TrialScreen />;
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

/** Сюжетная сцена поверх всего; развязка ждёт, пока игрок выйдет из боя. */
function StoryGate() {
  const story = useGame((s) => s.story);
  const screen = useGame((s) => s.screen);
  if (!story || (screen === 'battle' && !story.then)) return null;
  return <StoryOverlay />;
}

export function App() {
  // Фоновая музыка: в бою — боевая тема (с боссом — своя), в остальное время — тема лагеря.
  const musicId = useGame((s) =>
    s.screen === 'battle' && s.battle
      ? s.battle.mode === 'boss'
        ? 'boss'
        : 'battle'
      : s.ready
        ? 'camp'
        : null,
  );
  useEffect(() => {
    services.platform?.audio.music(musicId);
  }, [musicId]);
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

  if (!ready) return <BootSplash />;
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
      <StoryGate />
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
