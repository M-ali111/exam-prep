import { Router, Request, Response } from 'express';
import { authService } from '../services/auth';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Signup
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, username, password, schoolName, city, centerName } = req.body;

    if (!email || !username || !password || !schoolName || !city || !centerName) {
      return res.status(400).json({
        error: 'Missing required fields: username, email, password, schoolName, city, centerName',
      });
    }
    
    if (
      typeof email !== 'string' ||
      typeof username !== 'string' ||
      typeof password !== 'string' ||
      typeof schoolName !== 'string' ||
      typeof city !== 'string' ||
      typeof centerName !== 'string'
    ) {
      return res.status(400).json({
        error: 'Invalid field types: username, email, password, schoolName, city, centerName must be strings',
      });
    }

    const normalized = {
      email: email.trim(),
      username: username.trim(),
      password,
      schoolName: schoolName.trim(),
      city: city.trim(),
      centerName: centerName.trim(),
    };

    if (!normalized.email || !normalized.username || !normalized.password.trim() || !normalized.schoolName || !normalized.city || !normalized.centerName) {
      return res.status(400).json({
        error: 'All signup fields are required and cannot be empty',
      });
    }

    const result = await authService.signup(
      normalized.email,
      normalized.username,
      normalized.password,
      normalized.schoolName,
      normalized.city,
      normalized.centerName
    );
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing required fields: email, password' });
    }
    
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Invalid field types: email, password must be strings' });
    }

    const result = await authService.login(email, password);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await authService.getUserById(req.userId!);
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get user stats
router.get('/stats', authMiddleware, async (req: Request, res: Response) => {
  try {
    const stats = await authService.getUserStats(req.userId!);
    res.json(stats);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete current user account and all related data
router.delete('/account', authMiddleware, async (req: Request, res: Response) => {
  try {
    await authService.deleteAccount(req.userId!);
    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
