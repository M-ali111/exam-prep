import React from 'react';

interface ProfileData {
  totalGames: number;
  currentStreak: number;
  bestStreak: number;
  mathAccuracy: number;
  logicAccuracy: number;
  multiplayerWinRate: number;
  rank: number | null;
}

interface ProfileScreenProps {
  username: string;
  schoolName: string;
  city: string;
  centerName: string;
  data: ProfileData;
  onLogout: () => void;
  onDeleteAccount: () => void;
}

const getInitials = (username: string) =>
  username
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase())
    .slice(0, 2)
    .join('') || 'U';

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ username, schoolName, city, centerName, data, onLogout, onDeleteAccount }) => {
  const badges = [
    { icon: '🎯', title: 'First Game', unlocked: data.totalGames >= 1 },
    { icon: '🧠', title: 'Logic Master', unlocked: data.logicAccuracy > 70 },
    { icon: '🔢', title: 'Math Wizard', unlocked: data.mathAccuracy > 70 },
    { icon: '⚡', title: 'Speed Demon', unlocked: data.totalGames >= 10 },
    { icon: '🏆', title: 'Champion', unlocked: data.rank !== null && data.rank <= 10 },
    { icon: '🔥', title: 'On Fire', unlocked: data.currentStreak > 3 },
  ];

  const bars = [
    { label: 'Math accuracy', value: data.mathAccuracy, color: 'bg-teal-500' },
    { label: 'Logic accuracy', value: data.logicAccuracy, color: 'bg-purple-500' },
    { label: 'Multiplayer win rate', value: data.multiplayerWinRate, color: 'bg-green-500' },
  ];

  return (
    <div className="px-4 py-6 max-w-md mx-auto pb-24 space-y-4 animate-fade-in">
      <div className="bg-white shadow-md rounded-2xl p-6 text-center hover:shadow-lg transition-shadow duration-200">
        <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-teal-500 to-purple-500 text-white text-3xl font-bold flex items-center justify-center mb-4">
          {getInitials(username)}
        </div>
        <h2 className="text-2xl font-bold text-gray-900">{username}</h2>
        <div className="mt-4 grid gap-2 text-sm text-gray-600">
          <p><span className="font-semibold text-gray-900">School:</span> {schoolName}</p>
          <p><span className="font-semibold text-gray-900">City:</span> {city}</p>
          <p><span className="font-semibold text-gray-900">Center:</span> {centerName}</p>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-2xl p-4 hover:shadow-lg transition-shadow duration-200">
        <p className="text-lg font-bold text-gray-900 flex items-center justify-center gap-2">
          <span className="animate-flame">🔥</span> {data.currentStreak} day streak
        </p>
        <p className="text-sm font-medium text-gray-600 text-center mt-2">Best streak: {data.bestStreak} days</p>
      </div>

      <div className="bg-white shadow-md rounded-2xl p-4 hover:shadow-lg transition-shadow duration-200">
        <p className="text-gray-900 font-bold mb-3">Badges</p>
        <div className="grid grid-cols-2 gap-3">
          {badges.map((badge) => (
            <div
              key={badge.title}
              className={`rounded-xl p-3 border ${
                badge.unlocked
                  ? 'bg-amber-50 border-amber-200 text-gray-900'
                  : 'bg-gray-100 border-gray-200 text-gray-400'
              }`}
            >
              <p className="font-bold text-sm flex items-center gap-2">
                <span>{badge.unlocked ? badge.icon : '🔒'}</span>
                <span>{badge.title}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white shadow-md rounded-2xl p-4 hover:shadow-lg transition-shadow duration-200">
        <p className="text-gray-900 font-bold mb-3">Stats</p>
        <div className="space-y-3">
          {bars.map((item) => (
            <div key={item.label}>
              <div className="flex justify-between text-sm font-medium text-gray-600 mb-1">
                <span>{item.label}</span>
                <span>{item.value}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: `${item.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white shadow-md rounded-2xl p-4 text-center hover:shadow-lg transition-shadow duration-200">
        <p className="font-bold text-gray-900">🏆 Global Rank: {data.rank ? `#${data.rank}` : 'Unranked'}</p>
      </div>

      <button
        onClick={onLogout}
        className="w-full border-2 border-red-500 text-red-500 rounded-2xl min-h-[56px] font-bold text-lg hover:scale-105 transition-transform duration-200 shadow-sm"
      >
        Logout
      </button>

      <button
        onClick={onDeleteAccount}
        className="w-full bg-red-600 hover:bg-red-700 text-white rounded-2xl min-h-[56px] font-bold text-lg transition-colors duration-200 shadow-sm"
      >
        Delete Account
      </button>
    </div>
  );
};
