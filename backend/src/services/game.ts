import { PrismaClient } from '@prisma/client';
import { calculateNextDifficulty } from '../utils/difficulty';
import { questionService } from './question';
import { generateNisBilQuestions, NisBilDifficulty, NisBilQuestion, QuestionLanguage, QuestionSubject } from './aiQuestion';
import { recordGameForDay, updateStreakStatus } from './streak';

const prisma = new PrismaClient();
type NilSubject = 'mathematics' | 'natural_sciences' | 'english_language' | 'quantitative_aptitude';

const TOPICS_BY_SUBJECT: Record<NilSubject, string[]> = {
  mathematics: [
    'algebra equations',
    'fractions and decimals',
    'ratios and percentages',
    'geometry basics',
    'word problems',
  ],
  natural_sciences: [
    'motion and forces',
    'atomic structure',
    'cell structure and function',
    'energy and work',
    'chemical reactions',
  ],
  english_language: [
    'grammar and sentence structure',
    'reading comprehension',
    'vocabulary and word meaning',
    'tenses and verb forms',
    'synonyms and antonyms',
  ],
  quantitative_aptitude: [
    'number sequences',
    'pattern recognition',
    'logical deductions',
    'analogies',
    'data interpretation',
  ],
};

function pickRandomTopic(subject: NilSubject): string {
  const topics = TOPICS_BY_SUBJECT[subject];
  return topics[Math.floor(Math.random() * topics.length)];
}

function mapNilSubjectToAiSubject(subject: NilSubject): QuestionSubject {
  if (subject === 'mathematics') return 'math';
  if (subject === 'english_language') return 'english';
  if (subject === 'quantitative_aptitude') return 'logic';
  return ['physics', 'chemistry', 'biology'][Math.floor(Math.random() * 3)] as QuestionSubject;
}

function allowsDecimals(grade: number): boolean {
  return grade >= 5;
}

function allowsNegative(grade: number): boolean {
  return grade >= 5;
}

function formatOption(value: number, grade: number): string {
  if (allowsDecimals(grade)) {
    return value.toFixed(1);
  }
  return String(Math.round(value));
}

function normalizeAnswer(answer: number, grade: number): number {
  if (allowsDecimals(grade)) {
    return Math.round(answer * 10) / 10;
  }
  return Math.round(answer);
}

function buildAnswerOptions(answer: number, grade: number): string[] {
  const options = new Set<number>();
  const safeAnswer = Number.isFinite(answer) ? normalizeAnswer(answer, grade) : 0;
  options.add(safeAnswer);

  const spread = Math.max(5, Math.floor(Math.abs(safeAnswer) * 0.25));
  const maxAttempts = 50;

  for (let attempt = 0; attempt < maxAttempts && options.size < 4; attempt += 1) {
    const deltaBase = Math.floor(Math.random() * spread) + 1;
    const delta = allowsDecimals(grade) ? deltaBase / 10 : deltaBase;
    const candidate = Math.random() > 0.5 ? safeAnswer + delta : safeAnswer - delta;

    if (allowsNegative(grade) || candidate >= 0) {
      options.add(normalizeAnswer(candidate, grade));
    }
  }

  while (options.size < 4) {
    const fallback = allowsDecimals(grade) ? options.size / 10 : options.size;
    options.add(fallback);
  }

  const allOptions = Array.from(options);
  for (let i = allOptions.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
  }

  return allOptions.map((value) => formatOption(value, grade));
}

function mapDifficultyLabelToValue(label: NisBilDifficulty): number {
  if (label === 'hard') return 9;
  if (label === 'medium') return 6;
  return 3;
}

async function getAdaptiveDifficulty(userId: string): Promise<{ label: NisBilDifficulty; value: number }> {
  const recentGames = await prisma.gamePlayer.findMany({
    where: { userId, completedAt: { not: null } },
    orderBy: { completedAt: 'desc' },
    take: 5,
  });

  if (recentGames.length === 0) {
    return { label: 'easy', value: 3 };
  }

  const avgScore = recentGames.reduce((sum, game) => sum + game.score, 0) / recentGames.length;
  if (avgScore > 80) {
    return { label: 'hard', value: 9 };
  }
  if (avgScore >= 50) {
    return { label: 'medium', value: 6 };
  }
  return { label: 'easy', value: 3 };
}

async function getNisBilQuestions(params: {
  topic: string;
  count: number;
  difficulty: NisBilDifficulty;
  language: QuestionLanguage;
  subject: QuestionSubject;
  difficultyValue?: number;
}): Promise<NisBilQuestion[]> {
  return await generateNisBilQuestions({
    count: params.count,
    gradeLabel: 'NIS/BIL entry level',
    difficulty: params.difficulty,
    topic: params.topic,
    language: params.language,
    subject: params.subject,
    difficultyValue: params.difficultyValue,
  });
}

async function upsertQuestionFromAi(aiQuestion: NisBilQuestion, difficultyValue: number, language: QuestionLanguage, subject: QuestionSubject = 'math') {
  const optionsJson = JSON.stringify(aiQuestion.options);
  const correctAnswerIndex = aiQuestion.options.indexOf(aiQuestion.correctAnswer);

  if (correctAnswerIndex < 0) {
    throw new Error('AI question correct answer not found in options');
  }

  const existing = await prisma.question.findFirst({
    where: { text: aiQuestion.question, language, subject } as any,
  });

  if (existing) {
    const existingExplanation = (existing as { explanation?: string | null }).explanation;
    if (!existingExplanation && aiQuestion.explanation) {
      const updateData: any = { explanation: aiQuestion.explanation };
      return await prisma.question.update({
        where: { id: existing.id },
        data: updateData,
      });
    }

    return existing;
  }

  const createData = {
    text: aiQuestion.question,
    difficulty: difficultyValue,
    options: optionsJson,
    correctAnswer: correctAnswerIndex,
    language,
    subject,
    explanation: aiQuestion.explanation || null,
  } as any;

  return await prisma.question.create({
    data: createData,
  });
}

export const gameService = {
  /**
   * Create a new solo game
   */
  async createSoloGame(userId: string, language: QuestionLanguage, subject: NilSubject) {
    // Get user's current difficulty
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const adaptiveDifficulty = await getAdaptiveDifficulty(userId);

    const aiSubject = mapNilSubjectToAiSubject(subject);
    const topic = pickRandomTopic(subject);

    // Create game
    const game = await prisma.game.create({
      data: {
        gameType: 'solo',
        createdBy: userId,
        difficulty: adaptiveDifficulty.value,
        grade: 0,
        subject,
      },
    });

    // Create game player
    await prisma.gamePlayer.create({
      data: {
        gameId: game.id,
        userId,
      },
    });

    const storedQuestions = [] as Array<{ id: string; text: string; options: string[]; difficulty: number; explanation: string | null; subject: string }>;

    const aiQuestions = await getNisBilQuestions({
      topic,
      count: 10,
      difficulty: adaptiveDifficulty.label,
      language,
      subject: aiSubject,
      difficultyValue: adaptiveDifficulty.value,
    });

    for (let i = 0; i < aiQuestions.length; i++) {
      const aiQ = aiQuestions[i];
      const question = await upsertQuestionFromAi(aiQ, adaptiveDifficulty.value, language, aiSubject);

      await prisma.gameQuestion.create({
        data: {
          gameId: game.id,
          questionId: question.id,
          questionIndex: i,
        },
      });

      const explanation = (question as { explanation?: string | null }).explanation ?? null;
      storedQuestions.push({
        id: question.id,
        text: question.text,
        options: JSON.parse(question.options),
        difficulty: question.difficulty,
        explanation,
        subject: (question as { subject?: string }).subject ?? 'math',
      });
    }

    return {
      gameId: game.id,
      grade: game.grade,
      questions: storedQuestions,
    };
  },


  /**
   * Submit answer for a solo game
   */
  async submitSoloAnswer(gameId: string, userId: string, questionId: string, selectedAnswer: number, timeToAnswer: number) {
    // Verify answer
    const isCorrect = await questionService.verifyAnswer(questionId, selectedAnswer);

    // Save answer
    await prisma.gameAnswer.create({
      data: {
        gameId,
        userId,
        questionId,
        selectedAnswer,
        isCorrect,
        timeToAnswer,
      },
    });

    return isCorrect;
  },

  /**
   * Complete solo game and calculate final score
   */
  async completeSoloGame(gameId: string, userId: string) {
    const answers = await prisma.gameAnswer.findMany({
      where: { gameId, userId },
    });

    const correctAnswers = answers.filter((a) => a.isCorrect).length;
    const totalAnswers = answers.length;
    const score = (correctAnswers / totalAnswers) * 100;

    // Update game player
    await prisma.gamePlayer.update({
      where: {
        gameId_userId: { gameId, userId },
      },
      data: {
        score: Math.round(score),
        isWinner: true,
        completedAt: new Date(),
      },
    });

    // Update game status
    await prisma.game.update({
      where: { id: gameId },
      data: { status: 'completed' },
    });

    // Update user stats
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (user) {
      const nextDifficulty = calculateNextDifficulty(user.currentDifficulty, correctAnswers, totalAnswers);

      await prisma.user.update({
        where: { id: userId },
        data: {
          currentDifficulty: nextDifficulty,
          totalGamesPlayed: user.totalGamesPlayed + 1,
          totalWins: user.totalWins + 1,
          bestScore: Math.max(user.bestScore, Math.round(score)),
        },
      });

      // Record game for streak tracking
      await recordGameForDay(userId);
    }

    return {
      gameId,
      score: Math.round(score),
      correctAnswers,
      totalAnswers,
      nextDifficulty: user ? calculateNextDifficulty(user.currentDifficulty, correctAnswers, totalAnswers) : 1,
    };
  },

  /**
   * Create multiplayer game
   */
  async createMultiplayerGame(userId: string, _language: QuestionLanguage, subject: NilSubject) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const adaptiveDifficulty = await getAdaptiveDifficulty(userId);

    const game = await prisma.game.create({
      data: {
        gameType: 'multiplayer',
        createdBy: userId,
        difficulty: adaptiveDifficulty.value,
        grade: 0,
        subject,
      },
    });

    // Create game player entry for creator
    await prisma.gamePlayer.create({
      data: {
        gameId: game.id,
        userId,
      },
    });

    return {
      gameId: game.id,
      createdBy: userId,
      subject,
    };
  },

  /**
   * Join multiplayer game
   */
  async joinMultiplayerGame(gameId: string, userId: string, language: QuestionLanguage, subject: NilSubject) {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      throw new Error('Game not found');
    }

    if (game.status !== 'active') {
      throw new Error('Game is not active');
    }

    if (game.subject !== subject) {
      throw new Error('Selected subject does not match this game room');
    }

    // Check if user already joined
    const existingPlayer = await prisma.gamePlayer.findUnique({
      where: { gameId_userId: { gameId, userId } },
    });

    if (existingPlayer) {
      throw new Error('User already joined this game');
    }

    // Check if game already has 2 players
    const playerCount = await prisma.gamePlayer.count({
      where: { gameId },
    });

    if (playerCount >= 2) {
      throw new Error('Game is full');
    }

    // Add player
    await prisma.gamePlayer.create({
      data: {
        gameId,
        userId,
      },
    });

    // If 2 players now, generate AI questions
    if (playerCount === 1) {
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: { players: true },
      });

      if (!game) {
        throw new Error('Game not found');
      }

      if (game.players.length === 2) {
        const storedQuestions = [] as Array<{ id: string; text: string; options: string[]; difficulty: number; explanation: string | null }>;

        const difficultyLabel: NisBilDifficulty = game.difficulty >= 8 ? 'hard' : game.difficulty >= 5 ? 'medium' : 'easy';
        const nilSubject = game.subject as NilSubject;
        const gameSubject: QuestionSubject = mapNilSubjectToAiSubject(nilSubject);
        const topic = pickRandomTopic(nilSubject);
        
        const aiQuestions = await getNisBilQuestions({
          topic,
          count: 10,
          difficulty: difficultyLabel,
          language,
          subject: gameSubject,
          difficultyValue: game.difficulty,
        });

        for (let i = 0; i < aiQuestions.length; i++) {
          const aiQ = aiQuestions[i];
          const question = await upsertQuestionFromAi(aiQ, game.difficulty, language, gameSubject);

          await prisma.gameQuestion.create({
            data: {
              gameId: game.id,
              questionId: question.id,
              questionIndex: i,
            },
          });

          const explanation = (question as { explanation?: string | null }).explanation ?? null;
          storedQuestions.push({
            id: question.id,
            text: question.text,
            options: JSON.parse(question.options),
            difficulty: question.difficulty,
            explanation,
          });
        }

        return {
          gameId,
          status: 'ready',
          subject: nilSubject,
          questions: storedQuestions,
        };
      }
    }

    return {
      gameId,
      status: 'waiting',
      grade: game.grade,
    };
  },

  /**
   * Get game details
   */
  async getGameDetails(gameId: string) {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: {
          include: { user: true },
        },
        questions: {
          include: { question: true },
        },
      },
    });

    if (!game) {
      throw new Error('Game not found');
    }

    return game;
  },

  /**
   * Get leaderboard
   */
  async getLeaderboard(limit: number = 100) {
    // Get all users who have played at least one multiplayer game
    const usersWithMultiplayerGames = await prisma.gamePlayer.findMany({
      where: {
        game: {
          gameType: 'multiplayer',
          status: 'completed'
        }
      },
      select: {
        userId: true,
      },
      distinct: ['userId'],
    });

    const userIds = usersWithMultiplayerGames.map(gp => gp.userId);

    if (userIds.length === 0) {
      return [];
    }

    // Get user details
    const users = await prisma.user.findMany({
      where: {
        id: {
          in: userIds
        }
      },
      select: {
        id: true,
        username: true,
      },
    });

    // Calculate multiplayer wins and games for each user
    const leaderboardData = await Promise.all(
      users.map(async (user) => {
        // Get all multiplayer games where this user participated
        const multiplayerGames = await prisma.gamePlayer.findMany({
          where: {
            userId: user.id,
            game: {
              gameType: 'multiplayer',
              status: 'completed'
            }
          },
          include: {
            game: true
          }
        });

        // Count wins (isWinner = true)
        const totalMultiplayerWins = multiplayerGames.filter(gp => gp.isWinner).length;
        const totalMultiplayerGames = multiplayerGames.length;

        return {
          id: user.id,
          username: user.username,
          totalMultiplayerWins,
          totalMultiplayerGames
        };
      })
    );

    // Sort by wins descending, then by username ascending
    const sortedLeaderboard = leaderboardData
      .sort((a, b) => {
        if (b.totalMultiplayerWins !== a.totalMultiplayerWins) {
          return b.totalMultiplayerWins - a.totalMultiplayerWins;
        }
        return a.username.localeCompare(b.username);
      })
      .map((entry, index) => ({
        rank: index + 1,
        ...entry
      }));

    return sortedLeaderboard;
  },
};
