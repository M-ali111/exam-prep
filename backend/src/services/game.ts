import { PrismaClient } from '@prisma/client';
import { calculateNextDifficulty } from '../utils/difficulty';
import { questionService } from './question';
import { generateNisBilQuestions, NisBilDifficulty, NisBilQuestion, QuestionLanguage, QuestionSubject } from './aiQuestion';

const prisma = new PrismaClient();

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

const GRADE_LABELS: Record<number, string> = {
  0: 'general (all levels)',
  1: '1-6 primary',
  2: '5 to 6 entry',
  3: '6 to 7 entry',
};

const TOPICS_BY_GRADE: Record<number, string[]> = {
  1: ['addition', 'subtraction', 'multiplication', 'division', 'fractions', 'basic geometry', 'word problems', 'time', 'money'],
  2: ['fractions', 'decimals', 'ratios', 'percentages', 'basic algebra', 'area and perimeter', 'logic puzzles'],
  3: ['algebra equations', 'integers', 'coordinate geometry', 'percentages', 'multi-step word problems', 'pattern recognition'],
};

const LOGIC_TOPICS_BY_GRADE: Record<number, string[]> = {
  0: ['patterns', 'sequences', 'analogies', 'odd one out', 'logical deductions', 'matrix reasoning', 'series completion', 'abstract reasoning'],
  1: ['simple patterns', 'odd one out', 'basic sequences', 'picture logic', 'simple analogies'],
  2: ['number sequences', 'letter patterns', 'analogies', 'logical deductions', 'series completion'],
  3: ['complex patterns', 'matrix reasoning', 'multi-step logical deductions', 'verbal reasoning', 'abstract reasoning'],
};

const ENGLISH_TOPICS_BY_GRADE: Record<number, string[]> = {
  1: ['vocabulary building', 'basic grammar', 'simple sentences', 'reading comprehension', 'spelling', 'word order', 'pronouns', 'nouns and verbs'],
  2: ['tenses (present, past, future)', 'adjectives and adverbs', 'reading passages', 'vocabulary synonyms', 'sentence structure', 'articles (a, an, the)', 'prepositions'],
  3: ['complex grammar rules', 'reading comprehension with questions', 'essay understanding', 'vocabulary antonyms', 'subject-verb agreement', 'modal verbs', 'reported speech'],
};

const PHYSICS_TOPICS_BY_GRADE: Record<number, string[]> = {
  1: ['motion and speed', 'forces and gravity', 'simple machines', 'light and shadows', 'magnets', 'sound waves', 'states of matter'],
  2: ['energy types and transformation', 'work and power', 'pressure', 'heat and temperature', 'electricity basics', 'magnetism', 'simple circuits'],
  3: ['Newton\'s laws', 'momentum', 'energy conservation', 'electric circuits', 'electromagnetic induction', 'wave properties', 'optics and lenses'],
};

const CHEMISTRY_TOPICS_BY_GRADE: Record<number, string[]> = {
  1: ['matter properties', 'mixtures and solutions', 'elements and compounds', 'atomic structure basics', 'periodic table introduction', 'chemical vs physical changes'],
  2: ['chemical reactions', 'acids and bases', 'pH scale', 'chemical bonding', 'ionic and covalent bonds', 'chemical equations', 'stoichiometry basics'],
  3: ['oxidation and reduction', 'chemical equilibrium', 'reaction rates', 'organic chemistry introduction', 'hydrocarbons', 'functional groups', 'molar mass calculations'],
};

const BIOLOGY_TOPICS_BY_GRADE: Record<number, string[]> = {
  1: ['cells and cell structure', 'plant and animal differences', 'human body systems', 'food chains and ecosystems', 'classification of living things', 'photosynthesis basics'],
  2: ['cell division', 'genetics basics', 'DNA structure', 'heredity and traits', 'evolution introduction', 'ecosystems and biomes', 'human organ systems'],
  3: ['genetics and inheritance', 'Mendelian genetics', 'DNA replication', 'protein synthesis', 'natural selection', 'human anatomy and physiology', 'microbiology basics'],
};

const GEOGRAPHY_TOPICS_BY_GRADE: Record<number, string[]> = {
  1: ['continents and oceans', 'maps and globes', 'Kazakhstan geography', 'landforms', 'water bodies', 'weather and climate basics', 'natural resources'],
  2: ['political geography', 'countries and capitals', 'population and settlements', 'economic geography', 'Kazakhstan regions', 'natural disasters', 'climate zones'],
  3: ['physical geography advanced', 'Kazakhstan natural resources', 'global economic systems', 'urbanization', 'environmental issues', 'geopolitics', 'cultural geography'],
};

const HISTORY_TOPICS_BY_GRADE: Record<number, string[]> = {
  1: ['ancient civilizations', 'Kazakhstan ancient history', 'Silk Road', 'nomadic cultures', 'early settlements', 'historical figures of Kazakhstan'],
  2: ['medieval Kazakhstan', 'Kazakh Khanate', 'Golden Horde', 'independence of Kazakhstan', 'Soviet period', 'world history major events'],
  3: ['modern Kazakhstan history', 'independence movement', 'contemporary Kazakhstan', 'world wars', 'major historical figures', 'cultural and political developments'],
};

const INFORMATICS_TOPICS_BY_GRADE: Record<number, string[]> = {
  1: ['algorithms basics', 'flowcharts', 'sequences and loops', 'binary numbers', 'logic gates', 'basic programming concepts', 'problem solving'],
  2: ['data structures', 'arrays and lists', 'sorting algorithms', 'searching algorithms', 'conditional statements', 'functions and procedures', 'computational thinking'],
  3: ['advanced algorithms', 'recursion', 'object-oriented programming', 'database basics', 'networks and internet', 'cybersecurity basics', 'algorithm efficiency'],
};

function getGradeLabel(grade: number): string {
  return GRADE_LABELS[grade] || GRADE_LABELS[1];
}

function pickTopic(grade: number, subject: QuestionSubject = 'math'): string {
  let topicPool: Record<number, string[]>;
  
  switch (subject) {
    case 'logic':
      topicPool = LOGIC_TOPICS_BY_GRADE;
      break;
    case 'english':
      topicPool = ENGLISH_TOPICS_BY_GRADE;
      break;
    case 'physics':
      topicPool = PHYSICS_TOPICS_BY_GRADE;
      break;
    case 'chemistry':
      topicPool = CHEMISTRY_TOPICS_BY_GRADE;
      break;
    case 'biology':
      topicPool = BIOLOGY_TOPICS_BY_GRADE;
      break;
    case 'geography':
      topicPool = GEOGRAPHY_TOPICS_BY_GRADE;
      break;
    case 'history':
      topicPool = HISTORY_TOPICS_BY_GRADE;
      break;
    case 'informatics':
      topicPool = INFORMATICS_TOPICS_BY_GRADE;
      break;
    default: // math
      topicPool = TOPICS_BY_GRADE;
  }
  
  const topics = topicPool[grade] || topicPool[1];
  return topics[Math.floor(Math.random() * topics.length)];
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
  grade: number;
  count: number;
  difficulty: NisBilDifficulty;
  language: QuestionLanguage;
  subject: QuestionSubject;
  difficultyValue?: number;
}): Promise<NisBilQuestion[]> {
  const gradeLabel = getGradeLabel(params.grade);
  const topic = pickTopic(params.grade, params.subject);
  return await generateNisBilQuestions({
    count: params.count,
    gradeLabel,
    difficulty: params.difficulty,
    topic,
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
  async createSoloGame(userId: string, grade: number, language: QuestionLanguage, subject: QuestionSubject = 'math') {
    // Get user's current difficulty
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const adaptiveDifficulty = await getAdaptiveDifficulty(userId);

    // Create game
    const game = await prisma.game.create({
      data: {
        gameType: 'solo',
        createdBy: userId,
        difficulty: adaptiveDifficulty.value,
        grade,
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
      grade,
      count: 10,
      difficulty: adaptiveDifficulty.label,
      language,
      subject,
      difficultyValue: adaptiveDifficulty.value,
    });

    for (let i = 0; i < aiQuestions.length; i++) {
      const aiQ = aiQuestions[i];
      const question = await upsertQuestionFromAi(aiQ, adaptiveDifficulty.value, language, subject);

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
  async createMultiplayerGame(userId: string, grade: number, _language: QuestionLanguage, subject: QuestionSubject = 'math') {
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
        grade,
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
      grade: game.grade,
    };
  },

  /**
   * Join multiplayer game
   */
  async joinMultiplayerGame(gameId: string, userId: string, grade: number, language: QuestionLanguage, subject: QuestionSubject = 'math') {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      throw new Error('Game not found');
    }

    if (game.status !== 'active') {
      throw new Error('Game is not active');
    }

    if (game.grade !== grade) {
      throw new Error(`This room is for Grade ${game.grade} players only`);
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
        const gameSubject = (game as any).subject as QuestionSubject || 'math';
        
        const aiQuestions = await getNisBilQuestions({
          grade: game.grade,
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
          grade: game.grade,
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
    // Get all users
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
      },
    });

    // Calculate multiplayer wins and games for each user
    const leaderboardData = await Promise.all(
      allUsers.map(async (user) => {
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
