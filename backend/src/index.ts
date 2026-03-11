import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { setupSocket } from './sockets/game';
import authRoutes from './routes/auth';
import gameRoutes from './routes/game';
import statsRoutes from './routes/stats';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      process.env.FRONTEND_URL || ''
    ],
    credentials: true,
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    process.env.FRONTEND_URL || ''
  ],
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/stats', statsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Setup socket events
setupSocket(io);

// Start server
const PORT = process.env.PORT || 5050;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
