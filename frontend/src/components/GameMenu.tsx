import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useApi } from '../utils/api';
import { ProfileScreen } from './ProfileScreen';
import { Subject, QuestionLanguage, useGame } from '../context/GameContext';

interface GameMenuProps {
  onSelectSubject: (subject: Subject) => void;
  onSelectNav: (nav: 'stats' | 'leaderboard') => void;
  onLogout: () => void;
}

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  todayGameCount: number;
  lastStreakDate: string | null;
}

const SUBJECT_LABELS_BY_LANGUAGE: Record<QuestionLanguage, Record<Subject, string>> = {
  english: {
    mathematics: 'Mathematics',
    natural_sciences: 'Natural Sciences',
    english_language: 'English Language',
    quantitative_aptitude: 'Quantitative Aptitude',
    bil_mathematics_logic: 'BIL Mathematics & Logic',
    bil_kazakh_language: 'BIL Kazakh Language',
    bil_history_kazakhstan: 'BIL History of Kazakhstan',
    ielts_reading: 'IELTS Reading',
    ielts_writing_skills: 'IELTS Writing Skills',
    ielts_vocabulary: 'IELTS Vocabulary',
    unt_reading_literacy: 'UNT Reading Literacy',
    unt_math_literacy: 'UNT Math Literacy',
    unt_history_kazakhstan: 'UNT History of Kazakhstan',
    unt_profile_math: 'UNT Profile Mathematics',
    unt_profile_physics: 'UNT Profile Physics',
  },
  russian: {
    mathematics: 'Математика',
    natural_sciences: 'Естественные науки',
    english_language: 'English Language',
    quantitative_aptitude: 'Количественные способности',
    bil_mathematics_logic: 'BIL Математика и Логика',
    bil_kazakh_language: 'BIL Казахский язык',
    bil_history_kazakhstan: 'BIL История Казахстана',
    ielts_reading: 'IELTS Reading',
    ielts_writing_skills: 'IELTS Writing Skills',
    ielts_vocabulary: 'IELTS Vocabulary',
    unt_reading_literacy: 'Грамотность чтения UNT',
    unt_math_literacy: 'Математическая грамотность UNT',
    unt_history_kazakhstan: 'История Казахстана UNT',
    unt_profile_math: 'Профильная математика UNT',
    unt_profile_physics: 'Профильная физика UNT',
  },
  kazakh: {
    mathematics: 'Математика',
    natural_sciences: 'Жаратылыстану',
    english_language: 'English Language',
    quantitative_aptitude: 'Сандық қабілет',
    bil_mathematics_logic: 'BIL Математика және Логика',
    bil_kazakh_language: 'BIL Қазақ тілі',
    bil_history_kazakhstan: 'BIL Қазақстан тарихы',
    ielts_reading: 'IELTS Reading',
    ielts_writing_skills: 'IELTS Writing Skills',
    ielts_vocabulary: 'IELTS Vocabulary',
    unt_reading_literacy: 'UNT Оқу сауаттылығы',
    unt_math_literacy: 'UNT Математикалық сауаттылық',
    unt_history_kazakhstan: 'UNT Қазақстан тарихы',
    unt_profile_math: 'UNT Бейіндік математика',
    unt_profile_physics: 'UNT Бейіндік физика',
  },
};

export const GameMenu: React.FC<GameMenuProps> = ({ onSelectSubject, onSelectNav, onLogout }) => {
  const { user, deleteAccount } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { setSelectedLanguage } = useGame();
  const { request } = useApi();
  const [activeTab, setActiveTab] = useState<'home' | 'profile'>('home');
  const [rank] = useState<number | null>(null);
  const [streakData, setStreakData] = useState<StreakData>({
    currentStreak: 0,
    longestStreak: 0,
    todayGameCount: 0,
    lastStreakDate: null,
  });
  const [lastGameSettings, setLastGameSettings] = useState<{
    subject: Subject;
    language: 'english' | 'russian' | 'kazakh';
    mode: 'solo';
  } | null>(null);



  const totalGames = (user as any)?.totalGamesPlayed || 0;
  const totalWins = (user as any)?.totalWins || 0;
  const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;
  const mathAccuracy = Number(localStorage.getItem('examPrepMathAccuracy') || 0);
  const logicAccuracy = Number(localStorage.getItem('examPrepLogicAccuracy') || 0);

  useEffect(() => {
    const storedSettings = localStorage.getItem('lastGameSettings');
    if (storedSettings) {
      try {
        const parsed = JSON.parse(storedSettings);
        if (parsed?.subject && parsed?.language && parsed?.mode === 'solo') {
          setLastGameSettings(parsed);
        }
      } catch {
        setLastGameSettings(null);
      }
    }

    // Fetch streak data from API
    const fetchStreakData = async () => {
      try {
        const data = await request('/stats/streak');
        setStreakData(data);
      } catch (error) {
        console.error('Failed to fetch streak data:', error);
      }
    };

    fetchStreakData();
  }, [request]);

  const quickPlayLabel = useMemo(() => {
    if (!lastGameSettings) return '';
    const languageLabel =
      lastGameSettings.language === 'english'
        ? 'English'
        : lastGameSettings.language === 'russian'
        ? 'Russian'
        : 'Kazakh';
    const subjectLabelMap = SUBJECT_LABELS_BY_LANGUAGE[lastGameSettings.language];
    return `⚡ Quick Play — ${subjectLabelMap[lastGameSettings.subject]}, ${languageLabel}`;
  }, [lastGameSettings]);

  const activeSubjectLabels = useMemo(() => SUBJECT_LABELS_BY_LANGUAGE[language], [language]);

  const handleLanguageChange = (nextLanguage: QuestionLanguage) => {
    setLanguage(nextLanguage);
    setSelectedLanguage(nextLanguage);
  };

  const handleQuickPlay = () => {
    if (!lastGameSettings) return;

    setLanguage(lastGameSettings.language);
    setSelectedLanguage(lastGameSettings.language);
    localStorage.setItem('quickPlayPending', 'true');
    localStorage.setItem('quickPlaySettings', JSON.stringify(lastGameSettings));
    onSelectSubject(lastGameSettings.subject);
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm('Are you sure you want to delete your account? This action cannot be undone.');
    if (!confirmed) return;

    try {
      await deleteAccount();
      alert('Your account and all related data were deleted successfully.');
      onLogout();
    } catch (error: any) {
      alert(error?.message || 'Failed to delete account');
    }
  };

  if (activeTab === 'profile') {
    return (
      <div className="flex flex-col min-h-screen bg-amber-50 overflow-y-auto">
        <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-white/50 shadow-sm px-4 py-4 text-center">
          <h1 className="text-xl font-bold text-gray-900">Profile</h1>
        </div>

        <ProfileScreen
          username={user?.username || 'Player'}
          schoolName={user?.schoolName || '-'}
          city={user?.city || '-'}
          centerName={user?.centerName || '-'}
          data={{
            totalGames,
            currentStreak: streakData.currentStreak,
            bestStreak: streakData.longestStreak,
            mathAccuracy,
            logicAccuracy,
            multiplayerWinRate: winRate,
            rank,
          }}
          onLogout={onLogout}
          onDeleteAccount={handleDeleteAccount}
        />

        <div className="fixed bottom-4 left-0 right-0 z-50 px-4">
          <div className="max-w-md mx-auto bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border border-gray-100 px-2 py-2 flex justify-around">
            <button
              onClick={() => setActiveTab('home')}
              className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all duration-200 text-xs font-semibold min-w-[60px] text-gray-400 hover:text-gray-600"
            >
              <span className="text-xl">🏠</span>
              <span>Home</span>
            </button>
            <button
              onClick={() => onSelectNav('leaderboard')}
              className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all duration-200 text-xs font-semibold min-w-[60px] text-gray-400 hover:text-gray-600"
            >
              <span className="text-xl">🏆</span>
              <span>Leaderboard</span>
            </button>
            <button
              onClick={() => onSelectNav('stats')}
              className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all duration-200 text-xs font-semibold min-w-[60px] text-gray-400 hover:text-gray-600"
            >
              <span className="text-xl">📈</span>
              <span>Stats</span>
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all duration-200 text-xs font-semibold min-w-[60px] bg-cyan-500/10 text-cyan-600"
            >
              <span className="text-xl">👤</span>
              <span>Profile</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-100 overflow-y-auto animate-fade-in">
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-white/50 shadow-sm px-4 py-4 text-center">
        <div className="text-xl font-bold text-gray-900">🧠 Exam - Prep</div>
      </div>

      {/* Hero welcome banner */}
      <div className="bg-gradient-to-br from-cyan-500 to-teal-600 px-4 pb-6 pt-4 text-white">
        <div className="max-w-md mx-auto">
          <p className="text-lg font-semibold opacity-80">Good day,</p>
          <p className="text-2xl font-bold">{user?.username} 👋</p>
          {streakData.currentStreak > 0 && (
            <span className="inline-flex items-center gap-1 mt-2 bg-white/20 rounded-full px-3 py-1 text-sm font-semibold">
              🔥 {streakData.currentStreak} day streak
            </span>
          )}
        </div>
      </div>

      <div className="px-4 py-4 max-w-md mx-auto pb-24 space-y-4 w-full">
        <div className="bg-white rounded-2xl shadow-sm p-3 flex items-center gap-2">
          <div className="flex flex-1 gap-1.5">
            {[
              { key: 'english', label: 'EN', flag: '🇬🇧' },
              { key: 'russian', label: 'Рус', flag: '🇷🇺' },
              { key: 'kazakh', label: 'Қаз', flag: '🇰🇿' },
            ].map((langOption) => (
              <button
                key={langOption.key}
                onClick={() => handleLanguageChange(langOption.key as QuestionLanguage)}
                className={`flex-1 flex flex-col items-center gap-0.5 rounded-xl py-2 text-xs font-bold transition-all duration-200 ${
                  language === langOption.key
                    ? 'bg-cyan-500 text-white shadow-sm scale-105'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span className="text-base">{langOption.flag}</span>
                <span>{langOption.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-r from-amber-200 via-yellow-200 to-orange-200 rounded-2xl shadow-md px-4 py-3 hover:shadow-lg transition-shadow duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🔥</span>
              <div>
                <p className="font-bold text-gray-900 text-sm">Today's Goal</p>
                <p className="text-xs text-gray-600">{streakData.todayGameCount}/3 games today • Longest: {streakData.longestStreak}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-5 h-2 rounded-full transition-all ${i < streakData.todayGameCount ? 'bg-orange-500' : 'bg-white/60'}`}
                  />
                ))}
              </div>
              <span className="text-2xl font-bold text-orange-600">{streakData.currentStreak}</span>
            </div>
          </div>
        </div>

        <a
          href="https://docs.google.com/forms/d/e/1FAIpQLSeB2OPr7cSpUyAJIDBDi140rMCbW31Jg_tMAl-Ec4Nt-hMVHA/viewform"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-2xl px-4 py-3 shadow-sm hover:shadow-md transition-shadow duration-200"
        >
          <span className="text-2xl">📝</span>
          <div>
            <p className="font-bold text-gray-900 text-sm">Enjoying the app? Let us know!</p>
            <p className="text-teal-600 text-xs font-semibold">Give feedback → takes 1 minute</p>
          </div>
        </a>

        {lastGameSettings && (
          <button
            onClick={handleQuickPlay}
            className="w-full border-2 border-teal-500 text-teal-600 bg-white rounded-2xl px-4 py-4 min-h-[56px] font-bold shadow-sm hover:scale-105 transition-transform duration-200"
          >
            {quickPlayLabel}
          </button>
        )}

        <p className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider">NIS — Nazarbayev Intellectual Schools</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {[
            { key: 'mathematics', title: activeSubjectLabels.mathematics },
            { key: 'natural_sciences', title: activeSubjectLabels.natural_sciences },
            { key: 'english_language', title: activeSubjectLabels.english_language },
            { key: 'quantitative_aptitude', title: activeSubjectLabels.quantitative_aptitude },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => onSelectSubject(item.key as Subject)}
              className="relative w-full bg-orange-500 hover:bg-orange-600 text-white rounded-2xl p-2 sm:p-3 md:p-4 text-left shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 min-h-[90px] sm:min-h-[110px] md:min-h-[130px]"
            >
              <span className="absolute top-2 right-2 text-[9px] sm:text-[11px] font-bold bg-white text-orange-600 rounded-full px-1.5 sm:px-2 py-0.5">NIS</span>
              <h2 className="text-xs sm:text-sm font-bold leading-tight mt-4">{item.title}</h2>
            </button>
          ))}
        </div>

        <p className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider">BIL — Bilim-Innovation Lyceum</p>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { key: 'bil_mathematics_logic', title: activeSubjectLabels.bil_mathematics_logic.replace('BIL ', ''), sub: '55 questions' },
            { key: 'bil_kazakh_language', title: activeSubjectLabels.bil_kazakh_language.replace('BIL ', ''), sub: '10 questions' },
            { key: 'bil_history_kazakhstan', title: activeSubjectLabels.bil_history_kazakhstan.replace('BIL ', ''), sub: '10 questions' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => onSelectSubject(item.key as Subject)}
              className="relative w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl p-2 sm:p-3 md:p-4 text-left shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 min-h-[90px] sm:min-h-[110px] md:min-h-[130px]"
            >
              <span className="absolute top-2 right-2 text-[9px] sm:text-[11px] font-bold bg-white text-blue-600 rounded-full px-1.5 sm:px-2 py-0.5">BIL</span>
              <h2 className="text-xs sm:text-sm font-bold leading-tight mt-4">{item.title}</h2>
              <p className="text-[10px] sm:text-xs text-blue-200 mt-1">{item.sub}</p>
            </button>
          ))}
        </div>

        <p className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider">IELTS — International English Language Testing</p>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { key: 'ielts_reading', title: `📖 ${activeSubjectLabels.ielts_reading.replace('IELTS ', '')}`, sub: 'Passage-based MCQ' },
            { key: 'ielts_writing_skills', title: `✍️ ${activeSubjectLabels.ielts_writing_skills.replace('IELTS ', '')}`, sub: 'Grammar & structure' },
            { key: 'ielts_vocabulary', title: `🎓 ${activeSubjectLabels.ielts_vocabulary.replace('IELTS ', '')}`, sub: 'Word-in-context' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => onSelectSubject(item.key as Subject)}
              className="relative w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl p-2 sm:p-3 md:p-4 text-left shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 min-h-[90px] sm:min-h-[110px] md:min-h-[130px]"
            >
              <span className="absolute top-2 right-2 text-[9px] sm:text-[11px] font-bold bg-white text-emerald-600 rounded-full px-1.5 sm:px-2 py-0.5">IELTS</span>
              <h2 className="text-xs sm:text-sm font-bold leading-tight mt-4">{item.title}</h2>
              <p className="text-[10px] sm:text-xs text-emerald-200 mt-1">{item.sub}</p>
            </button>
          ))}
        </div>

        <p className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider">UNT — Unified National Testing (Kazakhstan)</p>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { key: 'unt_reading_literacy', title: activeSubjectLabels.unt_reading_literacy, sub: 'UNT core section' },
            { key: 'unt_math_literacy', title: activeSubjectLabels.unt_math_literacy, sub: 'UNT core section' },
            { key: 'unt_history_kazakhstan', title: activeSubjectLabels.unt_history_kazakhstan, sub: 'UNT core section' },
            { key: 'unt_profile_math', title: activeSubjectLabels.unt_profile_math, sub: 'UNT profile subject' },
            { key: 'unt_profile_physics', title: activeSubjectLabels.unt_profile_physics, sub: 'UNT profile subject' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => onSelectSubject(item.key as Subject)}
              className="relative w-full bg-gray-600 hover:bg-gray-700 text-white rounded-2xl p-2 sm:p-3 md:p-4 text-left shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 min-h-[90px] sm:min-h-[110px] md:min-h-[130px]"
            >
              <span className="absolute top-2 right-2 text-[9px] sm:text-[11px] font-bold bg-white text-gray-700 rounded-full px-1.5 sm:px-2 py-0.5">UNT</span>
              <h2 className="text-xs sm:text-sm font-bold leading-tight mt-4">{item.title}</h2>
              <p className="text-[10px] sm:text-xs text-gray-200 mt-1">{item.sub}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="fixed bottom-4 left-0 right-0 z-50 px-4">
        <div className="max-w-md mx-auto bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border border-gray-100 px-2 py-2 flex justify-around">
          <button
            className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all duration-200 text-xs font-semibold min-w-[60px] bg-cyan-500/10 text-cyan-600"
          >
            <span className="text-xl">🏠</span>
            <span>Home</span>
          </button>
          <button
            onClick={() => onSelectNav('leaderboard')}
            className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all duration-200 text-xs font-semibold min-w-[60px] text-gray-400 hover:text-gray-600"
          >
            <span className="text-xl">🏆</span>
            <span>Leaderboard</span>
          </button>
          <button
            onClick={() => onSelectNav('stats')}
            className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all duration-200 text-xs font-semibold min-w-[60px] text-gray-400 hover:text-gray-600"
          >
            <span className="text-xl">📈</span>
            <span>Stats</span>
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all duration-200 text-xs font-semibold min-w-[60px] text-gray-400 hover:text-gray-600"
          >
            <span className="text-xl">👤</span>
            <span>Profile</span>
          </button>
        </div>
      </div>
    </div>
  );
};
