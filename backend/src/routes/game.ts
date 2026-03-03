import { Router, Request, Response } from 'express';
import { gameService } from '../services/game';
import { authMiddleware } from '../middleware/auth';

const router = Router();

function parseGrade(value: unknown): number {
  const grade = Number(value);
  if (!Number.isInteger(grade) || grade < 0 || grade > 3) {
    throw new Error('Invalid grade option. Please select a valid entry level.');
  }
  return grade;
}

function parseLanguage(value: unknown): 'english' | 'russian' | 'kazakh' {
  if (!value) return 'english';
  if (value === 'english' || value === 'russian' || value === 'kazakh') {
    return value;
  }
  throw new Error('Invalid language option.');
}

function parseSubject(value: unknown): 'math' | 'logic' | 'english' {
  if (!value) return 'math';
  if (value === 'math' || value === 'logic' || value === 'english') {
    return value;
  }
  throw new Error('Invalid subject option.');
}

// Solo game routes
router.post('/solo/start', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { grade, language, subject } = req.body;
    
    if (grade === undefined || language === undefined || subject === undefined) {
      return res.status(400).json({ error: 'Missing required fields: grade, language, subject' });
    }
    
    const parsedGrade = parseGrade(grade);
    const parsedLanguage = parseLanguage(language);
    const parsedSubject = parseSubject(subject);
    const gameData = await gameService.createSoloGame(req.userId!, parsedGrade, parsedLanguage, parsedSubject);
    res.json(gameData);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


router.post('/solo/:gameId/answer', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const { questionId, selectedAnswer, timeToAnswer } = req.body;

    if (questionId === undefined || selectedAnswer === undefined || timeToAnswer === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const isCorrect = await gameService.submitSoloAnswer(
      gameId,
      req.userId!,
      questionId,
      selectedAnswer,
      timeToAnswer
    );

    res.json({ isCorrect });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/solo/:gameId/complete', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const result = await gameService.completeSoloGame(gameId, req.userId!);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Multiplayer game routes
router.post('/multiplayer/create', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { grade, language, subject } = req.body;
    
    if (grade === undefined || language === undefined || subject === undefined) {
      return res.status(400).json({ error: 'Missing required fields: grade, language, subject' });
    }
    
    const parsedGrade = parseGrade(grade);
    const parsedLanguage = parseLanguage(language);
    const parsedSubject = parseSubject(subject);
    const gameData = await gameService.createMultiplayerGame(req.userId!, parsedGrade, parsedLanguage, parsedSubject);
    res.json(gameData);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/multiplayer/:gameId/join', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const { grade, language, subject } = req.body;
    
    if (!gameId) {
      return res.status(400).json({ error: 'Missing required field: gameId' });
    }
    
    if (grade === undefined || language === undefined || subject === undefined) {
      return res.status(400).json({ error: 'Missing required fields: grade, language, subject' });
    }
    
    const parsedGrade = parseGrade(grade);
    const parsedLanguage = parseLanguage(language);
    const parsedSubject = parseSubject(subject);
    const result = await gameService.joinMultiplayerGame(gameId, req.userId!, parsedGrade, parsedLanguage, parsedSubject);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:gameId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const game = await gameService.getGameDetails(gameId);
    res.json(game);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Leaderboard
router.get('/leaderboard/global', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const leaderboard = await gameService.getLeaderboard(limit);
    res.json(leaderboard);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
