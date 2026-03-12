import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../utils/api';
import { KAZAKHSTAN_CITIES, getSchoolsByCity } from '../utils/kazakhstanSchools';
import { Subject } from '../context/GameContext';

interface LeaderboardEntry {
  rank: number;
  id: string;
  username: string;
  schoolName: string;
  city: string;
  centerName: string;
  totalMultiplayerWins: number;
  totalMultiplayerGames: number;
}

interface LeaderboardProps {
  onBack?: () => void;
}

const SUBJECT_OPTIONS: Array<{ value: Subject; label: string }> = [
  { value: 'mathematics', label: 'NIS - Mathematics' },
  { value: 'natural_sciences', label: 'NIS - Natural Sciences' },
  { value: 'english_language', label: 'NIS - English Language' },
  { value: 'quantitative_aptitude', label: 'NIS - Quantitative Aptitude' },
  { value: 'bil_mathematics_logic', label: 'BIL - Mathematics & Logic' },
  { value: 'bil_kazakh_language', label: 'BIL - Kazakh Language' },
  { value: 'bil_history_kazakhstan', label: 'BIL - History of Kazakhstan' },
  { value: 'ielts_reading', label: 'IELTS - Reading' },
  { value: 'ielts_writing_skills', label: 'IELTS - Writing Skills' },
  { value: 'ielts_vocabulary', label: 'IELTS - Vocabulary' },
  { value: 'unt_reading_literacy', label: 'UNT - Reading Literacy' },
  { value: 'unt_math_literacy', label: 'UNT - Math Literacy' },
  { value: 'unt_history_kazakhstan', label: 'UNT - History of Kazakhstan' },
  { value: 'unt_profile_math', label: 'UNT - Profile Mathematics' },
  { value: 'unt_profile_physics', label: 'UNT - Profile Physics' },
];

const Leaderboard: React.FC<LeaderboardProps> = ({ onBack }) => {
  const { user } = useAuth();
  const { request } = useApi();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [activeCity, setActiveCity] = useState('');
  const [activeSchool, setActiveSchool] = useState('');
  const [activeSubject, setActiveSubject] = useState('');

  const availableSchools = getSchoolsByCity(selectedCity);
  const isFiltered = !!activeCity || !!activeSchool || !!activeSubject;

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (activeCity) params.set('city', activeCity);
      if (activeSchool) params.set('schoolName', activeSchool);
      if (activeSubject) params.set('subject', activeSubject);
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const response = await request(`/games/leaderboard/global${suffix}`);
      setLeaderboard(response);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();

    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchLeaderboard, 60000);

    return () => clearInterval(interval);
  }, [activeCity, activeSchool, activeSubject, request]);

  const applyFilters = () => {
    setActiveCity(selectedCity);
    setActiveSchool(selectedSchool);
    setActiveSubject(selectedSubject);
  };

  const clearFilters = () => {
    setSelectedCity('');
    setSelectedSchool('');
    setSelectedSubject('');
    setActiveCity('');
    setActiveSchool('');
    setActiveSubject('');
  };

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return '👑';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '';
  };

  const getPodiumColor = (rank: number) => {
    if (rank === 1) return 'from-yellow-300 to-yellow-400 text-gray-900';
    if (rank === 2) return 'from-gray-300 to-gray-400 text-gray-900';
    if (rank === 3) return 'from-orange-400 to-orange-500 text-white';
    return 'from-white to-gray-50 text-gray-900';
  };

  const topThree = leaderboard.slice(0, 3);
  const restOfList = leaderboard.slice(3);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f5f5f0] to-[#e8e8dd] flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-cyan-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f5f5f0] to-[#e8e8dd] p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6 relative">
          {onBack && (
            <button
              onClick={onBack}
              className="absolute left-0 top-0 p-3 rounded-full bg-white shadow-md hover:bg-gray-50 active:bg-gray-100 transition-colors min-w-[48px] min-h-[48px] flex items-center justify-center"
            >
              <span className="text-2xl">←</span>
            </button>
          )}
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-1">🏆 Leaderboard</h1>
          <p className="text-base sm:text-sm text-gray-600">
            {isFiltered ? 'Filtered results' : 'Global leaderboard'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-5 mb-6 space-y-3">
          <p className="text-sm font-bold text-gray-900">Filters</p>
          <select
            value={selectedCity}
            onChange={(e) => {
              setSelectedCity(e.target.value);
              setSelectedSchool('');
            }}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
          >
            <option value="">All cities</option>
            {KAZAKHSTAN_CITIES.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
          <select
            value={selectedSchool}
            onChange={(e) => setSelectedSchool(e.target.value)}
            disabled={!selectedCity}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option value="">All schools</option>
            {availableSchools.map((school) => (
              <option key={school} value={school}>
                {school}
              </option>
            ))}
          </select>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
          >
            <option value="">All subjects</option>
            {SUBJECT_OPTIONS.map((subject) => (
              <option key={subject.value} value={subject.value}>
                {subject.label}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={applyFilters}
              className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2.5 rounded-xl text-sm"
            >
              Apply Filters
            </button>
            <button
              onClick={clearFilters}
              className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold py-2.5 rounded-xl text-sm"
            >
              Show Global
            </button>
          </div>
        </div>

        {/* Top 3 Podium */}
        {topThree.length > 0 && (
          <div className="mb-6 space-y-3">
            {topThree.map((entry) => {
              const isCurrentUser = user?.id === entry.id;
              return (
                <div
                  key={entry.id}
                  className={`bg-gradient-to-r ${getPodiumColor(entry.rank)} rounded-2xl p-4 sm:p-5 shadow-lg ${
                    isCurrentUser ? 'ring-4 ring-teal-400' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    {/* Medal Icon */}
                    <div className="text-5xl sm:text-4xl flex-shrink-0">
                      {getMedalEmoji(entry.rank)}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg sm:text-xl font-bold truncate">
                          {entry.username}
                          {isCurrentUser && <span className="text-xs ml-1">(You)</span>}
                        </h3>
                      </div>
                      <p className="text-sm sm:text-xs text-gray-600 mt-1">
                        {entry.totalMultiplayerGames} game{entry.totalMultiplayerGames !== 1 ? 's' : ''} played
                      </p>
                      <p className="text-xs sm:text-[11px] text-gray-600 mt-1 truncate">
                        {entry.schoolName}
                      </p>
                      <p className="text-xs sm:text-[11px] text-gray-500 truncate">
                        {entry.city} • {entry.centerName}
                      </p>
                    </div>

                    {/* Wins Badge */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-3xl sm:text-4xl font-bold">
                        {entry.totalMultiplayerWins}
                      </div>
                      <div className="text-xs sm:text-sm font-semibold">
                        win{entry.totalMultiplayerWins !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Rest of Leaderboard */}
        {restOfList.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-5 max-h-[400px] overflow-y-auto">
            <div className="space-y-2">
              {restOfList.map((entry) => {
                const isCurrentUser = user?.id === entry.id;
                return (
                  <div
                    key={entry.id}
                    className={`p-3 sm:p-4 rounded-xl transition-all ${
                      isCurrentUser
                        ? 'bg-gradient-to-r from-teal-100 to-teal-200 border-2 border-teal-400'
                        : 'bg-gray-50 hover:bg-gray-100 active:bg-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Rank */}
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold flex-shrink-0 text-base sm:text-lg ${
                        isCurrentUser ? 'bg-teal-500 text-white' : 'bg-gray-200 text-gray-700'
                      }`}>
                        {entry.rank}
                      </div>

                      {/* User Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-800 truncate text-base">
                          {entry.username}
                          {isCurrentUser && <span className="text-xs text-teal-600 ml-1">(You)</span>}
                        </div>
                        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                          {entry.totalMultiplayerGames} game{entry.totalMultiplayerGames !== 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{entry.schoolName}</p>
                        <p className="text-xs text-gray-400 truncate">{entry.city} • {entry.centerName}</p>
                      </div>

                      {/* Wins Badge */}
                      <div className="text-right flex-shrink-0">
                        <div className="text-xl sm:text-2xl font-bold text-gray-800">
                          {entry.totalMultiplayerWins}
                        </div>
                        <div className="text-xs text-gray-500">
                          win{entry.totalMultiplayerWins !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {leaderboard.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
            <div className="text-7xl sm:text-6xl mb-4">🏆</div>
            <h3 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-2">No Players Found</h3>
            <p className="text-gray-600 text-base">
              {isFiltered
                ? 'No players match this filter. Try another city, school, or subject, or click Show Global.'
                : 'Be the first to play and top the global leaderboard!'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;

