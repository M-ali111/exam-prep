import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { useGame, Subject } from './context/GameContext';
import { Login } from './components/Login';
import { GameMenu } from './components/GameMenu';
import { ModeSelection } from './components/ModeSelection';
import { TopicSelection } from './components/TopicSelection';
import { SoloGame } from './components/SoloGame';
import { MultiplayerGame } from './components/MultiplayerGame';
import { Stats } from './components/Stats';
import Leaderboard from './components/Leaderboard';
import { OnboardingScreen } from './components/OnboardingScreen';

type AppState = 
  | 'login' 
  | 'menu' 
  | 'mode-selection'
  | 'topic-selection'
  | 'solo' 
  | 'multiplayer' 
  | 'stats'
  | 'leaderboard';

const AppContent: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('login');
  const [selectedGameMode, setSelectedGameMode] = useState<'solo' | 'multiplayer' | 'random' | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { user, token, logout } = useAuth();
  const { subject, setSubject, setSelectedMode, setSelectedTopic, resetGameFlow } = useGame();

  useEffect(() => {
    if (token && user) {
      setAppState('menu');

      const justSignedUp = localStorage.getItem('zerekIqJustSignedUp') === 'true';
      const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding') === 'true';
      setShowOnboarding(justSignedUp && !hasSeenOnboarding);
    } else {
      setAppState('login');
      setShowOnboarding(false);
    }
  }, [token, user]);

  const handleLogout = () => {
    logout();
    resetGameFlow();
    setAppState('login');
  };

  const handleSelectSubject = (selectedSubject: Subject) => {
    setSubject(selectedSubject);
    setAppState('mode-selection');
  };

  const handleSelectNav = (nav: 'stats' | 'leaderboard') => {
    if (nav === 'stats') {
      setAppState('stats');
    } else if (nav === 'leaderboard') {
      setAppState('leaderboard');
    }
  };

  const handleModeSelected = (mode: 'solo' | 'multiplayer' | 'random') => {
    setSelectedGameMode(mode);
    const actualMode = mode === 'random' ? 'solo' : mode; // Convert random to solo for context
    setSelectedMode(actualMode);
    
    // All subjects go to topic selection
    setAppState('topic-selection');
  };

  const handleTopicSelected = (topic: string) => {
    setSelectedTopic(topic);
    // After topic selection, go to the game
    if (selectedGameMode === 'solo' || selectedGameMode === 'random') {
      setAppState('solo');
    } else {
      setAppState('multiplayer');
    }
  };

  const handleBackFromModeSelection = () => {
    setAppState('menu');
  };

  const handleBackFromTopicSelection = () => {
    setAppState('mode-selection');
  };

  const handleBack = () => {
    resetGameFlow();
    setAppState('menu');
  };

  return (
    <div>
      {token && user && showOnboarding && (
        <OnboardingScreen onComplete={() => setShowOnboarding(false)} />
      )}
      {!showOnboarding && (
        <>
      {appState === 'login' && <Login onLoginSuccess={() => setAppState('menu')} />}
      {appState === 'menu' && (
        <GameMenu 
          onSelectSubject={handleSelectSubject}
          onSelectNav={handleSelectNav}
          onLogout={handleLogout}
        />
      )}
      {appState === 'mode-selection' && subject && (
        <ModeSelection 
          onModeSelect={handleModeSelected}
          onBack={handleBackFromModeSelection}
        />
      )}
      {appState === 'topic-selection' && subject && (
        <TopicSelection 
          onTopicSelected={handleTopicSelected}
          onBack={handleBackFromTopicSelection}
        />
      )}
      {appState === 'solo' && <SoloGame onBack={handleBack} />}
      {appState === 'multiplayer' && <MultiplayerGame onBack={handleBack} />}
      {appState === 'stats' && <Stats onBack={handleBack} />}
      {appState === 'leaderboard' && <Leaderboard onBack={handleBack} />}
        </>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return <AppContent />;
};

export default App;
