import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function toPercent(correct: number, total: number): number {
  if (!total) return 0;
  return Math.round((correct / total) * 1000) / 10;
}

function buildStreaks(dateKeys: string[]) {
  if (dateKeys.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  const uniqueKeys = Array.from(new Set(dateKeys));
  const sorted = uniqueKeys.sort();

  let longestStreak = 1;
  let currentRun = 1;

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = (curr.getTime() - prev.getTime()) / MS_PER_DAY;
    if (diff === 1) {
      currentRun += 1;
      longestStreak = Math.max(longestStreak, currentRun);
    } else {
      currentRun = 1;
    }
  }

  const dateSet = new Set(uniqueKeys);
  const todayKey = toDateKey(startOfUtcDay(new Date()));
  let currentStreak = 0;
  let cursor = startOfUtcDay(new Date());

  while (dateSet.has(toDateKey(cursor))) {
    currentStreak += 1;
    cursor = addDays(cursor, -1);
  }

  if (!dateSet.has(todayKey)) {
    currentStreak = 0;
  }

  return { currentStreak, longestStreak };
}

function buildDailySeries(
  days: number,
  soloMap: Map<string, { totalScore: number; count: number }>,
  multiMap: Map<string, { totalScore: number; count: number }>
) {
  const today = startOfUtcDay(new Date());
  const series: Array<{ date: string; soloAverageScore: number | null; multiplayerAverageScore: number | null }> = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset);
    const key = toDateKey(date);
    const soloEntry = soloMap.get(key);
    const multiEntry = multiMap.get(key);

    const soloAverageScore = soloEntry ? Math.round((soloEntry.totalScore / soloEntry.count) * 10) / 10 : null;
    const multiplayerAverageScore = multiEntry ? Math.round((multiEntry.totalScore / multiEntry.count) * 10) / 10 : null;

    series.push({ date: key, soloAverageScore, multiplayerAverageScore });
  }

  return series;
}

type ExamTrack = 'nis' | 'bil' | 'ielts' | 'unt' | 'other';

function mapQuestionSubjectToTrack(subject: string | null | undefined): ExamTrack {
  if (!subject) return 'other';

  if (subject === 'bil_math_logic' || subject === 'kazakh' || subject === 'history_kz') {
    return 'bil';
  }

  if (subject === 'ielts_reading' || subject === 'ielts_writing' || subject === 'ielts_vocab') {
    return 'ielts';
  }

  if (
    subject === 'unt_reading' ||
    subject === 'unt_math_literacy' ||
    subject === 'unt_history_kz' ||
    subject === 'unt_profile_math' ||
    subject === 'unt_profile_physics'
  ) {
    return 'unt';
  }

  if (
    subject === 'math' ||
    subject === 'logic' ||
    subject === 'english' ||
    subject === 'physics' ||
    subject === 'chemistry' ||
    subject === 'biology' ||
    subject === 'geography' ||
    subject === 'history' ||
    subject === 'informatics'
  ) {
    return 'nis';
  }

  return 'other';
}

function mapGameSubjectToTrack(subject: string | null | undefined): ExamTrack {
  if (!subject) return 'other';
  if (subject.startsWith('bil_')) return 'bil';
  if (subject.startsWith('ielts_')) return 'ielts';
  if (subject.startsWith('unt_')) return 'unt';

  if (
    subject === 'mathematics' ||
    subject === 'natural_sciences' ||
    subject === 'english_language' ||
    subject === 'quantitative_aptitude'
  ) {
    return 'nis';
  }

  return 'other';
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export const statsService = {
  async getDashboard(userId: string) {
    const answers = await prisma.gameAnswer.findMany({
      where: { userId },
      include: { question: true },
    });

    const gamePlayers = await prisma.gamePlayer.findMany({
      where: { userId },
      include: {
        game: {
          select: { gameType: true, createdAt: true, subject: true },
        },
      },
      orderBy: { completedAt: 'desc' },
    });

    const completedGames = gamePlayers.filter((game) => game.completedAt);
    const soloCompleted = completedGames.filter((game) => game.game.gameType === 'solo');
    const multiplayerCompleted = completedGames.filter((game) => game.game.gameType === 'multiplayer');

    const totalAnswers = answers.length;
    const correctAnswers = answers.filter((answer) => answer.isCorrect).length;

    const totalSoloGames = gamePlayers.filter((game) => game.game.gameType === 'solo').length;
    const totalMultiplayerGames = gamePlayers.filter((game) => game.game.gameType === 'multiplayer').length;

    const soloAverageScore = soloCompleted.length
      ? Math.round((soloCompleted.reduce((sum, game) => sum + game.score, 0) / soloCompleted.length) * 10) / 10
      : 0;

    const soloBestScore = soloCompleted.length
      ? Math.max(...soloCompleted.map((game) => game.score))
      : 0;

    const multiplayerWins = multiplayerCompleted.filter((game) => game.isWinner).length;
    const multiplayerLosses = multiplayerCompleted.filter((game) => !game.isWinner).length;
    const multiplayerWinRate = toPercent(multiplayerWins, multiplayerWins + multiplayerLosses);

    const now = new Date();
    const last30Start = addDays(startOfUtcDay(now), -29);
    const last7Start = addDays(startOfUtcDay(now), -6);

    const soloScoreMap = new Map<string, { totalScore: number; count: number }>();
    const multiplayerScoreMap = new Map<string, { totalScore: number; count: number }>();
    const activity7DayMap = new Map<string, number>();

    for (const game of completedGames) {
      const completedAt = game.completedAt;
      if (!completedAt) continue;

      if (completedAt >= last30Start) {
        const key = toDateKey(completedAt);
        const targetMap = game.game.gameType === 'multiplayer' ? multiplayerScoreMap : soloScoreMap;

        if (!targetMap.has(key)) {
          targetMap.set(key, { totalScore: 0, count: 0 });
        }

        const entry = targetMap.get(key)!;
        entry.totalScore += game.score;
        entry.count += 1;
      }

      if (completedAt >= last7Start) {
        const key = toDateKey(completedAt);
        activity7DayMap.set(key, (activity7DayMap.get(key) ?? 0) + 1);
      }
    }

    const performanceOverTime = buildDailySeries(30, soloScoreMap, multiplayerScoreMap);

    const last7DaySeries = Array.from({ length: 7 }).map((_, idx) => {
      const date = addDays(startOfUtcDay(now), -6 + idx);
      const key = toDateKey(date);
      return { date: key, games: activity7DayMap.get(key) ?? 0 };
    });
    const last7DayActivity = last7DaySeries.reduce((sum, day) => sum + day.games, 0);

    const streakDates = completedGames
      .filter((game) => game.completedAt)
      .map((game) => toDateKey(game.completedAt!));
    const { currentStreak, longestStreak } = buildStreaks(streakDates);

    const trackAnswers = {
      nis: answers.filter((a) => mapQuestionSubjectToTrack(a.question?.subject) === 'nis'),
      bil: answers.filter((a) => mapQuestionSubjectToTrack(a.question?.subject) === 'bil'),
      ielts: answers.filter((a) => mapQuestionSubjectToTrack(a.question?.subject) === 'ielts'),
      unt: answers.filter((a) => mapQuestionSubjectToTrack(a.question?.subject) === 'unt'),
    };

    const nisAccuracy = toPercent(
      trackAnswers.nis.filter((a) => a.isCorrect).length,
      trackAnswers.nis.length
    );
    const bilAccuracy = toPercent(
      trackAnswers.bil.filter((a) => a.isCorrect).length,
      trackAnswers.bil.length
    );

    const ieltsScores = soloCompleted
      .filter((g) => mapGameSubjectToTrack(g.game.subject) === 'ielts')
      .map((g) => g.score)
      .slice(0, 10);
    const ieltsBands = ieltsScores.map((score) => Math.max(1, Math.min(9, Math.round(1 + (score / 100) * 8))));

    const untScores = soloCompleted
      .filter((g) => mapGameSubjectToTrack(g.game.subject) === 'unt')
      .map((g) => g.score)
      .slice(0, 10);
    const untRawScores = untScores.map((score) => Math.round((score / 100) * 10));

    const timeSpentSeconds = {
      nis: trackAnswers.nis.reduce((sum, a) => sum + a.timeToAnswer, 0),
      bil: trackAnswers.bil.reduce((sum, a) => sum + a.timeToAnswer, 0),
      ielts: trackAnswers.ielts.reduce((sum, a) => sum + a.timeToAnswer, 0),
      unt: trackAnswers.unt.reduce((sum, a) => sum + a.timeToAnswer, 0),
    };

    const recentGamePlayers = await prisma.gamePlayer.findMany({
      where: { userId, completedAt: { not: null } },
      include: {
        game: {
          select: { gameType: true, createdAt: true },
        },
      },
      orderBy: { completedAt: 'desc' },
      take: 10,
    });

    const recentGames = recentGamePlayers.map((game) => ({
      gameId: game.gameId,
      date: game.completedAt ? game.completedAt.toISOString() : game.game.createdAt.toISOString(),
      mode: game.game.gameType,
      score: game.score,
      result: game.game.gameType === 'multiplayer' ? (game.isWinner ? 'Win' : 'Loss') : 'Completed',
    }));

    return {
      overview: {
        totalGames: totalSoloGames + totalMultiplayerGames,
        overallAccuracy: toPercent(correctAnswers, totalAnswers),
        currentStreak,
        longestStreak,
        multiplayerWinRate,
        last7DayActivity,
        last7DaySeries,
      },
      examTrackPerformance: {
        nisAccuracy,
        bilAccuracy,
        ieltsBandTrend: {
          averageBand: average(ieltsBands),
          recentBands: ieltsBands,
        },
        untScoreTrend: {
          averageRawScore: average(untRawScores),
          recentRawScores: untRawScores,
          rawScoreOutOf: 10,
        },
        timeSpentPerTrack: {
          nisMinutes: Math.round(timeSpentSeconds.nis / 60),
          bilMinutes: Math.round(timeSpentSeconds.bil / 60),
          ieltsMinutes: Math.round(timeSpentSeconds.ielts / 60),
          untMinutes: Math.round(timeSpentSeconds.unt / 60),
        },
      },
      subjectStats: {
        mathAccuracy: toPercent(
          answers.filter((a) => a.question?.subject === 'math' && a.isCorrect).length,
          answers.filter((a) => a.question?.subject === 'math').length
        ),
        logicAccuracy: toPercent(
          answers.filter((a) => a.question?.subject === 'logic' && a.isCorrect).length,
          answers.filter((a) => a.question?.subject === 'logic').length
        ),
      },
      soloStats: {
        totalGames: totalSoloGames,
        averageScore: soloAverageScore,
        bestScore: soloBestScore,
      },
      multiplayerStats: {
        totalGames: totalMultiplayerGames,
        wins: multiplayerWins,
        losses: multiplayerLosses,
        winRate: multiplayerWinRate,
      },
      performanceOverTime,
      recentGames,
    };
  },
};
