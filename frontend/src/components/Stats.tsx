import React, { useEffect, useState } from 'react';
import { useApi } from '../utils/api';

interface DashboardResponse {
  overview: {
    totalGames: number;
    overallAccuracy: number;
    currentStreak: number;
    longestStreak: number;
    multiplayerWinRate: number;
    last7DayActivity: number;
    last7DaySeries: Array<{
      date: string;
      games: number;
    }>;
  };
  examTrackPerformance: {
    nisAccuracy: number;
    bilAccuracy: number;
    ieltsBandTrend: {
      averageBand: number;
      recentBands: number[];
    };
    untScoreTrend: {
      averageRawScore: number;
      recentRawScores: number[];
      rawScoreOutOf: number;
    };
    timeSpentPerTrack: {
      nisMinutes: number;
      bilMinutes: number;
      ieltsMinutes: number;
      untMinutes: number;
    };
  };
}

interface StatsProps {
  onBack: () => void;
}

export const Stats: React.FC<StatsProps> = ({ onBack }) => {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const { request } = useApi();

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      try {
        const data = await request('/stats/dashboard');
        setDashboard(data);
      } catch (error: any) {
        alert(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [request]);

  if (loading || !dashboard) {
    return (
      <div className="flex flex-col min-h-screen bg-amber-50 items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-md">
          <div className="text-4xl mb-4">📊</div>
          <p className="text-xl font-bold text-gray-900">Loading stats...</p>
          <div className="mt-6 flex justify-center gap-1">
            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </div>
    );
  }

  const maxGamesIn7Days = Math.max(1, ...dashboard.overview.last7DaySeries.map((item) => item.games));

  return (
    <div className="flex flex-col min-h-screen bg-amber-50">
      <div className="bg-white shadow-sm px-4 py-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-center sm:text-left">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">📊 Stats Overview</h1>
            <p className="text-gray-500 text-base sm:text-sm mt-2">Your progress across NIS, BIL, IELTS and UNT</p>
          </div>
          <button
            onClick={onBack}
            className="w-full sm:w-auto bg-gray-300 hover:bg-gray-400 active:bg-gray-500 text-gray-900 font-bold py-3 sm:py-2 px-6 rounded-2xl transition-colors min-h-[48px]"
          >
            ← Back
          </button>
        </div>
      </div>

      <div className="flex-1 px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-2xl shadow-md p-4 text-center">
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Total Games</p>
              <p className="text-3xl font-bold text-cyan-600">{dashboard.overview.totalGames}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-md p-4 text-center">
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Overall Accuracy</p>
              <p className="text-3xl font-bold text-blue-600">{dashboard.overview.overallAccuracy}%</p>
            </div>
            <div className="bg-white rounded-2xl shadow-md p-4 text-center">
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Current / Longest</p>
              <p className="text-3xl font-bold text-orange-600">
                {dashboard.overview.currentStreak}/{dashboard.overview.longestStreak}
              </p>
            </div>
            <div className="bg-white rounded-2xl shadow-md p-4 text-center">
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Multiplayer Win Rate</p>
              <p className="text-3xl font-bold text-green-600">{dashboard.overview.multiplayerWinRate}%</p>
            </div>
            <div className="bg-white rounded-2xl shadow-md p-4 text-center col-span-2 lg:col-span-1">
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Last 7-Day Activity</p>
              <p className="text-3xl font-bold text-purple-600">{dashboard.overview.last7DayActivity}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-4 sm:p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">🗓️ Last 7-Day Activity</h2>
            <div className="grid grid-cols-7 gap-2 items-end h-36">
              {dashboard.overview.last7DaySeries.map((item) => {
                const height = Math.max(8, Math.round((item.games / maxGamesIn7Days) * 100));
                const dayLabel = new Date(item.date).toLocaleDateString(undefined, { weekday: 'short' });
                return (
                  <div key={item.date} className="flex flex-col items-center gap-2">
                    <div className="text-xs font-bold text-gray-600">{item.games}</div>
                    <div className="w-full bg-cyan-100 rounded-xl flex items-end" style={{ height: '100px' }}>
                      <div className="w-full bg-cyan-500 rounded-xl" style={{ height: `${height}%` }} />
                    </div>
                    <div className="text-[11px] text-gray-500 font-semibold">{dayLabel}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-4 sm:p-6 space-y-5">
            <h2 className="text-lg font-bold text-gray-900">🎯 Exam Track Performance</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                <p className="text-sm font-bold text-orange-700">NIS Accuracy</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">{dashboard.examTrackPerformance.nisAccuracy}%</p>
              </div>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-bold text-blue-700">BIL Accuracy</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{dashboard.examTrackPerformance.bilAccuracy}%</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-bold text-emerald-700">IELTS Band Trend</p>
                <p className="text-3xl font-bold text-emerald-600 mt-2">{dashboard.examTrackPerformance.ieltsBandTrend.averageBand || 0}</p>
                <p className="text-xs text-emerald-700 mt-2">
                  Recent bands: {dashboard.examTrackPerformance.ieltsBandTrend.recentBands.length
                    ? dashboard.examTrackPerformance.ieltsBandTrend.recentBands.join(', ')
                    : 'No recent IELTS tests'}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-300 bg-gray-100 p-4">
                <p className="text-sm font-bold text-gray-700">UNT Score Trend</p>
                <p className="text-3xl font-bold text-gray-800 mt-2">
                  {dashboard.examTrackPerformance.untScoreTrend.averageRawScore || 0}
                  <span className="text-base font-semibold text-gray-600"> / {dashboard.examTrackPerformance.untScoreTrend.rawScoreOutOf}</span>
                </p>
                <p className="text-xs text-gray-700 mt-2">
                  Recent raw scores: {dashboard.examTrackPerformance.untScoreTrend.recentRawScores.length
                    ? dashboard.examTrackPerformance.untScoreTrend.recentRawScores.join(', ')
                    : 'No recent UNT tests'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4">
              <p className="text-sm font-bold text-purple-700 mb-3">⏱️ Time Spent Per Track</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl p-3 text-center">
                  <p className="text-xs font-semibold text-gray-500">NIS</p>
                  <p className="text-xl font-bold text-gray-900">{dashboard.examTrackPerformance.timeSpentPerTrack.nisMinutes}m</p>
                </div>
                <div className="bg-white rounded-xl p-3 text-center">
                  <p className="text-xs font-semibold text-gray-500">BIL</p>
                  <p className="text-xl font-bold text-gray-900">{dashboard.examTrackPerformance.timeSpentPerTrack.bilMinutes}m</p>
                </div>
                <div className="bg-white rounded-xl p-3 text-center">
                  <p className="text-xs font-semibold text-gray-500">IELTS</p>
                  <p className="text-xl font-bold text-gray-900">{dashboard.examTrackPerformance.timeSpentPerTrack.ieltsMinutes}m</p>
                </div>
                <div className="bg-white rounded-xl p-3 text-center">
                  <p className="text-xs font-semibold text-gray-500">UNT</p>
                  <p className="text-xl font-bold text-gray-900">{dashboard.examTrackPerformance.timeSpentPerTrack.untMinutes}m</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Stats;
