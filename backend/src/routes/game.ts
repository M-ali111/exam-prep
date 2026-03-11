import { Router, Request, Response } from 'express';
import { gameService } from '../services/game';
import { authMiddleware } from '../middleware/auth';

const router = Router();

function parseLanguage(value: unknown): 'english' | 'russian' | 'kazakh' {
  if (!value) return 'english';
  if (value === 'english' || value === 'russian' || value === 'kazakh') {
    return value;
  }
  throw new Error('Invalid language option.');
}

type AllSubject = 'mathematics' | 'natural_sciences' | 'english_language' | 'quantitative_aptitude' | 'bil_mathematics_logic' | 'bil_kazakh_language' | 'bil_history_kazakhstan' | 'ielts_reading' | 'ielts_writing_skills' | 'ielts_vocabulary' | 'unt_reading_literacy' | 'unt_math_literacy' | 'unt_history_kazakhstan' | 'unt_profile_math' | 'unt_profile_physics';
function parseSubject(value: unknown): AllSubject {
  if (
    value === 'mathematics' || value === 'natural_sciences' ||
    value === 'english_language' || value === 'quantitative_aptitude' ||
    value === 'bil_mathematics_logic' || value === 'bil_kazakh_language' ||
    value === 'bil_history_kazakhstan' ||
    value === 'ielts_reading' || value === 'ielts_writing_skills' ||
    value === 'ielts_vocabulary' ||
    value === 'unt_reading_literacy' || value === 'unt_math_literacy' ||
    value === 'unt_history_kazakhstan' || value === 'unt_profile_math' ||
    value === 'unt_profile_physics'
  ) {
    return value as AllSubject;
  }
  throw new Error('Invalid subject option.');
}

// Solo game routes
router.post('/solo/start', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { subject, language } = req.body;
    
    if (subject === undefined || language === undefined) {
      return res.status(400).json({ error: 'Missing required fields: subject, language' });
    }
    
    const parsedLanguage = parseLanguage(language);
    const parsedSubject = parseSubject(subject);
    const gameData = await gameService.createSoloGame(req.userId!, parsedLanguage, parsedSubject);
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
    const { subject, language } = req.body;
    
    if (subject === undefined || language === undefined) {
      return res.status(400).json({ error: 'Missing required fields: subject, language' });
    }
    
    const parsedLanguage = parseLanguage(language);
    const parsedSubject = parseSubject(subject);
    const gameData = await gameService.createMultiplayerGame(req.userId!, parsedLanguage, parsedSubject);
    res.json(gameData);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/multiplayer/:gameId/join', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const { subject, language } = req.body;
    
    if (!gameId) {
      return res.status(400).json({ error: 'Missing required field: gameId' });
    }
    
    if (subject === undefined || language === undefined) {
      return res.status(400).json({ error: 'Missing required fields: subject, language' });
    }
    
    const parsedLanguage = parseLanguage(language);
    const parsedSubject = parseSubject(subject);
    const result = await gameService.joinMultiplayerGame(gameId, req.userId!, parsedLanguage, parsedSubject);
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
    const city = typeof req.query.city === 'string' ? req.query.city : undefined;
    const schoolName = typeof req.query.schoolName === 'string' ? req.query.schoolName : undefined;
    const leaderboard = await gameService.getLeaderboard(limit, { city, schoolName });
    res.json(leaderboard);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
