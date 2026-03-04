import React, { useEffect, useRef } from 'react';
import { useGame, GameMode } from '../context/GameContext';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../utils/translations';

interface ModeSelectionProps {
  onModeSelect: (mode: GameMode | 'random') => void;
  onBack: () => void;
}

export const ModeSelection: React.FC<ModeSelectionProps> = ({ onModeSelect, onBack }) => {
  const { subject } = useGame();
  const { language, setLanguage } = useLanguage();
  const quickPlayHandledRef = useRef(false);

  const t = translations[language];

  const modes: { value: GameMode | 'random'; label: string; description: string; icon: string }[] = [
    {
      value: 'solo',
      label: t.playSolo,
      description: 'Practice alone and improve your skills',
      icon: '👤',
    },
    {
      value: 'multiplayer',
      label: t.multiplayer,
      description: 'Compete with other players in real-time',
      icon: '🎮',
    },
  ];

  const handleSelectMode = (mode: GameMode | 'random') => {
    onModeSelect(mode);
  };

  useEffect(() => {
    if (quickPlayHandledRef.current) return;

    const isQuickPlayPending = localStorage.getItem('quickPlayPending') === 'true';
    if (!isQuickPlayPending) return;

    const rawSettings = localStorage.getItem('quickPlaySettings');
    if (!rawSettings) return;

    try {
      const settings = JSON.parse(rawSettings);
      if (settings?.language) {
        setLanguage(settings.language);
      }

      quickPlayHandledRef.current = true;

      // Clear quick play settings for all subjects
      localStorage.removeItem('quickPlayPending');
      localStorage.removeItem('quickPlaySettings');

      onModeSelect('solo');
    } catch {
      localStorage.removeItem('quickPlayPending');
      localStorage.removeItem('quickPlaySettings');
    }
  }, [onModeSelect, setLanguage, subject]);

  const isMath = subject === 'math';
  const isLogic = subject === 'logic';
  const isEnglish = subject === 'english';
  const isPhysics = subject === 'physics';
  const isChemistry = subject === 'chemistry';
  const isBiology = subject === 'biology';
  const isGeography = subject === 'geography';
  const isHistory = subject === 'history';
  const isInformatics = subject === 'informatics';

  const getButtonColor = () => {
    if (isMath) return 'bg-teal-500 hover:bg-teal-600 text-white';
    if (isLogic) return 'bg-purple-500 hover:bg-purple-600 text-white';
    if (isEnglish) return 'bg-amber-500 hover:bg-amber-600 text-white';
    if (isPhysics) return 'bg-indigo-500 hover:bg-indigo-600 text-white';
    if (isChemistry) return 'bg-green-500 hover:bg-green-600 text-white';
    if (isBiology) return 'bg-teal-400 hover:bg-teal-500 text-white';
    if (isGeography) return 'bg-cyan-500 hover:bg-cyan-600 text-white';
    if (isHistory) return 'bg-rose-500 hover:bg-rose-600 text-white';
    if (isInformatics) return 'bg-slate-500 hover:bg-slate-600 text-white';
    return 'bg-gray-500 hover:bg-gray-600 text-white';
  };

  const getHeaderColor = () => {
    if (isMath) return 'bg-teal-50 text-teal-700';
    if (isLogic) return 'bg-purple-50 text-purple-700';
    if (isEnglish) return 'bg-amber-50 text-amber-700';
    if (isPhysics) return 'bg-indigo-50 text-indigo-700';
    if (isChemistry) return 'bg-green-50 text-green-700';
    if (isBiology) return 'bg-teal-50 text-teal-700';
    if (isGeography) return 'bg-cyan-50 text-cyan-700';
    if (isHistory) return 'bg-rose-50 text-rose-700';
    if (isInformatics) return 'bg-slate-50 text-slate-700';
    return 'bg-gray-50 text-gray-700';
  };

  const getSubjectLabel = () => {
    if (isMath) return '🔢 Mathematics';
    if (isLogic) return '🧠 Logic & IQ';
    if (isEnglish) return '📚 English';
    if (isPhysics) return '⚛️ Physics';
    if (isChemistry) return '🧪 Chemistry';
    if (isBiology) return '🧬 Biology';
    if (isGeography) return '🌍 Geography';
    if (isHistory) return '📜 History';
    if (isInformatics) return '💻 Informatics';
    return '📚 Subject';
  };

  const buttonColor = getButtonColor();
  const headerBgColor = getHeaderColor();

  return (
    <div className="flex flex-col min-h-screen bg-amber-50 animate-fade-in">
      {/* Header */}
      <div className="bg-white shadow-sm px-4 py-6 text-center flex items-center justify-between">
        <button 
          onClick={onBack}
          className="text-cyan-500 hover:text-cyan-600 active:text-cyan-700 font-bold text-base sm:text-lg min-w-[60px] text-left"
        >
          ← {t.back}
        </button>
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t.selectMode}</h1>
        </div>
        <div className="w-[60px]"></div>
      </div>

      {/* Subject info */}
      <div className={`${headerBgColor} text-center px-4 py-3 text-base sm:text-sm font-semibold`}>
        {getSubjectLabel()}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-md mx-auto w-full">
        {/* Mode Cards */}
        <div className="w-full flex flex-col gap-4">
          {modes.map((mode) => (
            <button
              key={mode.value}
              onClick={() => handleSelectMode(mode.value)}
              className={`${buttonColor} rounded-2xl shadow-md p-6 sm:p-8 text-center hover:shadow-lg active:opacity-90 transition-all duration-200 hover:scale-105 min-h-[140px] w-full`}
            >
              <div className="text-5xl sm:text-4xl mb-3">{mode.icon}</div>
              <h2 className="text-xl sm:text-2xl font-bold">{mode.label}</h2>
              <p className="text-base sm:text-sm mt-2 opacity-90">{mode.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
