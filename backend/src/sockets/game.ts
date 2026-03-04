import { Server, Socket } from 'socket.io';
import { gameService } from '../services/game';
import { questionService } from '../services/question';
import { recordGameForDay } from '../services/streak';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../utils/jwt';
import { QuestionLanguage, QuestionSubject } from '../services/aiQuestion';

const prisma = new PrismaClient();
const gameAnswers = new Map<string, Map<string, boolean>>();
const onlineUsers = new Map<string, { userId: string; username: string; status: 'available' | 'in-game'; gameId?: string }>();

const buildOnlineUsersList = (excludeUserId?: string) => {
  const uniqueUsers = new Map<string, { userId: string; username: string; status: 'available' | 'in-game' }>();
  for (const info of onlineUsers.values()) {
    if (excludeUserId && info.userId === excludeUserId) {
      continue;
    }
    // Only include available users in the list
    if (info.status === 'available' && !uniqueUsers.has(info.userId)) {
      uniqueUsers.set(info.userId, { userId: info.userId, username: info.username, status: info.status });
    }
  }
  return Array.from(uniqueUsers.values());
};

const broadcastOnlineUsers = (io: Server) => {
  io.sockets.sockets.forEach((client) => {
    const userId = client.data.userId as string | undefined;
    if (!userId) return;
    client.emit('online_users', buildOnlineUsersList(userId));
  });
};

const findSocketIdByUserId = (userId: string) => {
  for (const [socketId, info] of onlineUsers.entries()) {
    if (info.userId === userId) {
      return socketId;
    }
  }
  return null;
};

const isGameStillActive = (status: string) => status !== 'completed' && status !== 'abandoned';

const handleOpponentLeft = async (gameId: string, leavingUserId: string, io: Server) => {
  try {
    console.log(`[handleOpponentLeft] Starting for gameId: ${gameId}, leavingUserId: ${leavingUserId}`);
    
    const game = await gameService.getGameDetails(gameId);
    console.log(`[handleOpponentLeft] Game found, status: ${game.status}`);
    console.log('Current game status:', game.status);
    
    // Check if game is still active
    if (!isGameStillActive(game.status)) {
      console.log(`[handleOpponentLeft] Game not active, skipping. Status: ${game.status}`);
      return;
    }

    // Find the other player
    const winnerPlayer = game.players.find((p) => p.userId !== leavingUserId);
    const loserPlayer = game.players.find((p) => p.userId === leavingUserId);

    if (!winnerPlayer || !loserPlayer) {
      console.log(`[handleOpponentLeft] Could not find both players. Winner: ${winnerPlayer?.userId}, Loser: ${loserPlayer?.userId}`);
      return;
    }

    console.log(`[handleOpponentLeft] Winner: ${winnerPlayer.userId}, Loser: ${loserPlayer.userId}`);

    // Mark the winner
    await prisma.gamePlayer.update({
      where: { id: winnerPlayer.id },
      data: { isWinner: true, score: 100, completedAt: new Date() },
    });

    // Mark the loser
    await prisma.gamePlayer.update({
      where: { id: loserPlayer.id },
      data: { isWinner: false, score: 0, completedAt: new Date() },
    });

    // Update game status
    await prisma.game.update({
      where: { id: gameId },
      data: { status: 'completed' },
    });

    // Notify the remaining player - use room name that matches join_game
    const roomName = `game:${gameId}`;
    const room = io.sockets.adapter.rooms.get(roomName);
    console.log('opponent_left roomName:', roomName);
    console.log('Room', gameId, 'has', room?.size, 'sockets');
    console.log('emitting opponent_left to room:', gameId);
    console.log(`[handleOpponentLeft] Emitting opponent_left to room: ${roomName}`);
    io.to(roomName).emit('opponent_left', {
      message: 'Your opponent left the game',
      result: 'win',
      gameId,
    });

    const remainingPlayer = game.players.find((player) => player.userId !== leavingUserId);
    if (remainingPlayer) {
      const remainingSocketIds = Array.from(onlineUsers.entries())
        .filter(([, info]) => info.userId === remainingPlayer.userId)
        .map(([socketId]) => socketId);

      for (const targetSocketId of remainingSocketIds) {
        io.to(targetSocketId).emit('opponent_left', {
          message: 'Your opponent left the game',
          result: 'win',
          gameId,
        });
      }
    }

    for (const userInfo of onlineUsers.values()) {
      if (game.players.some((player) => player.userId === userInfo.userId)) {
        userInfo.status = 'available';
        userInfo.gameId = undefined;
      }
    }
    broadcastOnlineUsers(io);

    // Clean up answer tracking
    gameAnswers.delete(gameId);
    console.log(`[handleOpponentLeft] Cleanup complete for gameId: ${gameId}`);
  } catch (error) {
    console.error('[handleOpponentLeft] Error handling opponent left:', error);
  }
};

export const setupSocket = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log('User connected:', socket.id);

    // Authenticate socket
    socket.on('authenticate', async (data: string | { token: string }) => {
      try {
        const token = typeof data === 'string' ? data : data.token;
        const decoded = verifyToken(token);
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, username: true },
        });

        if (!user) {
          socket.emit('auth_error', 'User not found');
          return;
        }

        socket.data.userId = user.id;
        onlineUsers.set(socket.id, { userId: user.id, username: user.username, status: 'available' });
        socket.emit('authenticated', { userId: user.id, username: user.username });
        broadcastOnlineUsers(io);
      } catch (error) {
        console.error('Auth error:', error);
        socket.emit('auth_error', 'Invalid token');
      }
    });

    socket.on('send_game_request', (data: { toUserId: string; topic: string; subject: QuestionSubject; language?: QuestionLanguage }) => {
      try {
        const fromUserId = socket.data.userId as string | undefined;
        if (!fromUserId) {
          socket.emit('error', 'Not authenticated');
          return;
        }

        const targetSocketId = findSocketIdByUserId(data.toUserId);
        if (!targetSocketId) {
          socket.emit('game_request_failed', { message: 'User is offline' });
          return;
        }

        // Check if target user is already in a game
        const targetUser = onlineUsers.get(targetSocketId);
        if (targetUser && targetUser.status === 'in-game') {
          socket.emit('game_request_failed', { message: 'User is already playing a game' });
          return;
        }

        const fromUser = onlineUsers.get(socket.id);
        io.to(targetSocketId).emit('game_request_received', {
          fromUserId,
          fromUsername: fromUser?.username || 'Player',
          topic: data.topic,
          subject: data.subject,
          language: data.language ?? 'english',
        });
      } catch (error: any) {
        socket.emit('error', error.message);
      }
    });

    socket.on('accept_game_request', async (data: { fromUserId: string; topic: string; subject: QuestionSubject; language?: QuestionLanguage }) => {
      try {
        const acceptUserId = socket.data.userId as string | undefined;
        if (!acceptUserId) {
          socket.emit('error', 'Not authenticated');
          return;
        }

        const senderSocketId = findSocketIdByUserId(data.fromUserId);
        if (!senderSocketId) {
          socket.emit('game_request_failed', { message: 'User is offline' });
          return;
        }

        const language = data.language ?? 'english';
        const gameData = await gameService.createMultiplayerGame(data.fromUserId, data.topic, language, data.subject);
        await gameService.joinMultiplayerGame(gameData.gameId, acceptUserId, data.topic, language, data.subject);

        const senderInfo = onlineUsers.get(senderSocketId);
        const acceptInfo = onlineUsers.get(socket.id);

        // Update both players' status to in-game
        if (senderInfo) senderInfo.status = 'in-game';
        if (acceptInfo) acceptInfo.status = 'in-game';
        broadcastOnlineUsers(io);

        io.to([senderSocketId, socket.id]).emit('game_request_accepted', {
          gameId: gameData.gameId,
          topic: data.topic,
          language,
          players: [
            { userId: data.fromUserId, username: senderInfo?.username || 'Player' },
            { userId: acceptUserId, username: acceptInfo?.username || 'Player' },
          ],
        });
      } catch (error: any) {
        socket.emit('error', error.message);
      }
    });

    socket.on('decline_game_request', (data: { fromUserId: string }) => {
      try {
        const senderSocketId = findSocketIdByUserId(data.fromUserId);
        if (!senderSocketId) {
          return;
        }

        io.to(senderSocketId).emit('game_request_declined', {
          fromUserId: data.fromUserId,
        });
      } catch (error: any) {
        socket.emit('error', error.message);
      }
    });

    // Join multiplayer game
    socket.on('join_game', async (gameId: string) => {
      try {
        const userId = socket.data.userId;
        
        if (!userId) {
          socket.emit('error', 'Not authenticated');
          return;
        }

        console.log(`[join_game] User ${userId} joining game ${gameId}`);
        console.log('Player joining room:', gameId, 'socketId:', socket.id);

        // Track the game this socket is in (both in socket data and online users map)
        socket.data.gameId = gameId;
        console.log('Set socket.data.gameId:', socket.data.gameId);
        const userInfo = onlineUsers.get(socket.id);
        if (userInfo) {
          userInfo.gameId = gameId;
          userInfo.status = 'in-game';
          console.log(`[join_game] Socket data set:`, socket.data);
          console.log(`[join_game] Online users updated with gameId: ${gameId}`);
          broadcastOnlineUsers(io);
        }

        // Join socket room
        const roomName = `game:${gameId}`;
        socket.join(roomName);
        console.log('join_game roomName:', roomName);
        console.log(`[join_game] Socket joined room: ${roomName}`);

        // Get game details
        const game = await gameService.getGameDetails(gameId);
        const playerCount = game.players.length;

        // Notify others that someone joined
        io.to(`game:${gameId}`).emit('player_joined', {
          gameId,
          playerCount,
          players: game.players.map((p) => ({
            id: p.userId,
            username: p.user.username,
          })),
        });

        // If 2 players now, start game
        if (playerCount === 2) {
          const questions = game.questions.map((gq) => ({
            id: gq.question.id,
            text: gq.question.text,
            options: JSON.parse(gq.question.options),
            difficulty: gq.question.difficulty,
            subject: gq.question.subject,
            explanation: (gq.question as { explanation?: string | null }).explanation ?? null,
          }));

          io.to(`game:${gameId}`).emit('game_started', {
            gameId,
            questions,
          });

          // Initialize answer tracking
          gameAnswers.set(gameId, new Map());
        }
      } catch (error: any) {
        socket.emit('error', error.message);
      }
    });

    // Submit answer in multiplayer
    socket.on('submit_answer', async (data: { gameId: string; questionId: string; selectedAnswer: number; timeToAnswer: number }) => {
      try {
        const userId = socket.data.userId;
        
        if (!userId) {
          socket.emit('error', 'Not authenticated');
          return;
        }
        
        const { gameId, questionId, selectedAnswer, timeToAnswer } = data;

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

        // Get answers map for this game
        let answers = gameAnswers.get(gameId);
        if (!answers) {
          answers = new Map();
          gameAnswers.set(gameId, answers);
        }

        // Store answer
        answers.set(userId, isCorrect);

        // Broadcast answer (don't reveal correct answer)
        io.to(`game:${gameId}`).emit('answer_submitted', {
          userId,
          isCorrect,
          timeToAnswer,
        });

        // Check if both players answered
        const game = await gameService.getGameDetails(gameId);
        if (answers.size === game.players.length) {
          // Find winner of this round (first to answer correctly, or fastest)
          const roundAnswers = await prisma.gameAnswer.findMany({
            where: { gameId, questionId },
            orderBy: { createdAt: 'asc' },
          });

          let winner = null;
          for (const answer of roundAnswers) {
            if (answer.isCorrect) {
              winner = answer.userId;
              break;
            }
          }

          // Get current question index and send next
          const currentQuestionIndex = game.questions.findIndex(q => q.questionId === questionId);
          const nextQuestionIndex = currentQuestionIndex + 1;

          console.log(`[submit_answer] Player ${userId} answered for game ${gameId}`);
          console.log(`[submit_answer] Answers so far:`, Array.from(answers.entries()));
          console.log(`[submit_answer] Both players answered: true`);
          console.log(`[submit_answer] Current question index: ${currentQuestionIndex}, Next: ${nextQuestionIndex}`);

          io.to(`game:${gameId}`).emit('round_result', {
            winner,
            nextQuestionIndex,
          });

          // Clear answers for next round
          answers.clear();

          // If that was the last question, end the game automatically
          if (nextQuestionIndex >= game.questions.length) {
            console.log(`[submit_answer] Game ${gameId} completed - all questions answered`);
            // Calculate scores for both players
            const allAnswers = await prisma.gameAnswer.findMany({
              where: { gameId },
            });

            // Group by user
            const userScores = new Map<string, { correct: number; total: number }>();
            for (const answer of allAnswers) {
              const uid = answer.userId;
              if (!userScores.has(uid)) {
                userScores.set(uid, { correct: 0, total: 0 });
              }
              const userScore = userScores.get(uid)!;
              userScore.total++;
              if (answer.isCorrect) userScore.correct++;
            }

            // Update all players
            for (const [userId, scoreData] of userScores) {
              const score = Math.round((scoreData.correct / scoreData.total) * 100);
              await prisma.gamePlayer.update({
                where: { gameId_userId: { gameId: gameId, userId: userId } },
                data: {
                  score,
                  completedAt: new Date(),
                },
              });
            }

            // Determine winner
            const gamePlayers = await prisma.gamePlayer.findMany({
              where: { gameId },
              include: { user: true },
            });

            const sortedPlayers = gamePlayers.sort((a, b) => b.score - a.score);
            const winnerPlayer = sortedPlayers[0];
            const loserPlayer = sortedPlayers[1];

            // Mark winner
            await prisma.gamePlayer.update({
              where: { id: winnerPlayer.id },
              data: { isWinner: true },
            });

            // Update game status
            await prisma.game.update({
              where: { id: gameId },
              data: { status: 'completed' },
            });

            // Get who answered each question correctly first
            const questionWinners: { questionId: string; winnerId: string | null }[] = [];
            for (const gq of game.questions) {
              const qAnswers = await prisma.gameAnswer.findMany({
                where: { gameId, questionId: gq.questionId },
                orderBy: { createdAt: 'asc' },
              });
              
              let qWinner: string | null = null;
              for (const ans of qAnswers) {
                if (ans.isCorrect) {
                  qWinner = ans.userId;
                  break;
                }
              }
              questionWinners.push({ questionId: gq.questionId, winnerId: qWinner });
            }

            // Emit game ended
            io.to(`game:${gameId}`).emit('game_ended', {
              winner: winnerPlayer.userId,
              winnerName: winnerPlayer.user.username,
              loser: loserPlayer.userId,
              loserName: loserPlayer.user.username,
              winnerScore: winnerPlayer.score,
              loserScore: loserPlayer.score,
              questionWinners,
            });

            // Record games for streak tracking
            await recordGameForDay(winnerPlayer.userId);
            await recordGameForDay(loserPlayer.userId);

            // Update both players' status back to available
            for (const [socketId, userInfo] of onlineUsers.entries()) {
              if (userInfo.userId === winnerPlayer.userId || userInfo.userId === loserPlayer.userId) {
                userInfo.status = 'available';
              }
            }
            broadcastOnlineUsers(io);

            // Clean up
            gameAnswers.delete(gameId);
          } else {
            // Send next question after short delay
            console.log(`[submit_answer] Moving to question index: ${nextQuestionIndex}`);
            setTimeout(() => {
              const nextQuestion = game.questions[nextQuestionIndex];
              if (nextQuestion) {
                const questionData = {
                  id: nextQuestion.question.id,
                  text: nextQuestion.question.text,
                  options: JSON.parse(nextQuestion.question.options),
                  difficulty: nextQuestion.question.difficulty,
                  explanation: (nextQuestion.question as { explanation?: string | null }).explanation ?? null,
                };
                
                console.log(`[submit_answer] Emitting next_question for game ${gameId}, question index ${nextQuestionIndex}`);
                io.to(`game:${gameId}`).emit('next_question', {
                  question: questionData,
                  questionIndex: nextQuestionIndex,
                  totalQuestions: game.questions.length,
                });
              }
            }, 2000);  // 2 second delay to show round result
          }
        }
      } catch (error: any) {
        socket.emit('error', error.message);
      }
    });

    // End game
    socket.on('end_game', async (gameId: string) => {
      try {
        const userId = socket.data.userId;
        
        if (!userId) {
          socket.emit('error', 'Not authenticated');
          return;
        }

        // Get all answers
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
            completedAt: new Date(),
          },
        });

        // Check if both players completed
        const gamePlayer = await prisma.gamePlayer.findMany({
          where: { gameId },
        });

        const allCompleted = gamePlayer.every((p) => p.completedAt !== null);

        if (allCompleted) {
          const scores = gamePlayer.sort((a, b) => b.score - a.score);
          const winner = scores[0];
          const loser = scores[1];

          // Mark winner
          await prisma.gamePlayer.update({
            where: { id: winner.id },
            data: { isWinner: true },
          });

          // Update game status
          await prisma.game.update({
            where: { id: gameId },
            data: { status: 'completed' },
          });

          // Get player details
          const winnerUser = await prisma.user.findUnique({ where: { id: winner.userId } });
          const loserUser = await prisma.user.findUnique({ where: { id: loser.userId } });

          // Get who answered each question first
          const questionResults = await prisma.gameQuestion.findMany({
            where: { gameId },
            include: {
              question: true,
            },
          });

          const questionWinners = await Promise.all(
            questionResults.map(async (gq) => {
              const firstCorrect = await prisma.gameAnswer.findFirst({
                where: {
                  gameId,
                  questionId: gq.questionId,
                  isCorrect: true,
                },
                orderBy: { createdAt: 'asc' },
              });

              return {
                questionId: gq.questionId,
                questionIndex: gq.questionIndex,
                correctAnswerBy: firstCorrect?.userId || null,
              };
            })
          );

          // Broadcast game end
          io.to(`game:${gameId}`).emit('game_ended', {
            winner: winner.userId,
            winnerName: winnerUser?.username,
            loser: loser.userId,
            loserName: loserUser?.username,
            winnerScore: winner.score,
            loserScore: loser.score,
            questionWinners: questionWinners,
          });

          // Record games for streak tracking
          await recordGameForDay(winner.userId);
          await recordGameForDay(loser.userId);

          // Update both players' status back to available
          for (const [socketId, userInfo] of onlineUsers.entries()) {
            if (userInfo.userId === winner.userId || userInfo.userId === loser.userId) {
              userInfo.status = 'available';
            }
          }
          broadcastOnlineUsers(io);
        }
      } catch (error: any) {
        socket.emit('error', error.message);
      }
    });

    socket.on('update_user_status', (status: 'available' | 'in-game') => {
      try {
        const userInfo = onlineUsers.get(socket.id);
        if (userInfo) {
          userInfo.status = status;
          broadcastOnlineUsers(io);
        }
      } catch (error: any) {
        socket.emit('error', error.message);
      }
    });

    socket.on('leave_game', async (data: { gameId: string }) => {
      try {
        const userId = socket.data.userId as string | undefined;
        if (!userId) {
          socket.emit('error', 'Not authenticated');
          return;
        }

        console.log('leave_game received from:', socket.data.userId);

        const userInfo = onlineUsers.get(socket.id);
        const gameId = data?.gameId || (socket.data.gameId as string | undefined) || userInfo?.gameId;
        if (!gameId) {
          console.log('[leave_game] No active gameId found for socket');
          return;
        }

        console.log('leave_game received:', gameId);

        const game = await prisma.game.findUnique({
          where: { id: gameId },
          select: { status: true },
        });
        console.log('Current game status:', game?.status);
        if (!game || game.status !== 'active') {
          return;
        }

        console.log(`[leave_game] User ${userId} leaving game ${gameId}`);

        const roomName = `game:${gameId}`;
        const room = io.sockets.adapter.rooms.get(roomName);
        console.log('Room', gameId, 'has', room?.size, 'sockets');
        socket.leave(roomName);
        socket.data.gameId = undefined;

        // Also clear from onlineUsers map
        if (userInfo) {
          userInfo.gameId = undefined;
          userInfo.status = 'available';
        }
        broadcastOnlineUsers(io);

        console.log(`[leave_game] Handling opponent left for game ${gameId}`);

        // Handle opponent left logic
        await handleOpponentLeft(gameId, userId, io);
      } catch (error: any) {
        socket.emit('error', error.message);
      }
    });

    socket.on('quit_game', async (data: { gameId: string; userId: string }) => {
      try {
        const userId = (socket.data.userId as string | undefined) || data.userId;
        const gameId = data.gameId || (socket.data.gameId as string | undefined);
        if (!userId || !gameId) {
          return;
        }

        console.log(`[quit_game] Aliasing to leave_game. User ${userId} quitting game ${gameId}`);

        const userInfo = onlineUsers.get(socket.id);
        if (userInfo) {
          userInfo.status = 'available';
          userInfo.gameId = undefined;
        }
        socket.data.gameId = undefined;
        socket.leave(`game:${gameId}`);

        await handleOpponentLeft(gameId, userId, io);
      } catch (error) {
        console.error('[quit_game] Error handling quit game:', error);
        socket.emit('error', error instanceof Error ? error.message : 'Unknown error');
      }
    });

    socket.on('disconnect', async () => {
      console.log(`[disconnect] User disconnected: ${socket.id}`);
      console.log('disconnect - socket.data.gameId:', socket.data.gameId);

      const userId = socket.data.userId as string | undefined;
      let gameId = socket.data.gameId as string | undefined;
      
      // If gameId not in socket.data, try to get it from onlineUsers map
      if (!gameId) {
        const userInfo = onlineUsers.get(socket.id);
        if (userInfo) {
          gameId = userInfo.gameId;
        }
      }

      console.log('disconnect handler - gameId:', gameId);

      console.log(`[disconnect] userId: ${userId}, gameId: ${gameId}`);

      // Handle opponent disconnect during game
      if (userId && gameId) {
        const game = await prisma.game.findUnique({
          where: { id: gameId },
          select: { status: true },
        });
        console.log('Current game status:', game?.status);

        if (!game || game.status !== 'active') {
          console.log(`[disconnect] Game not active for gameId ${gameId}, skipping opponent_left`);
          if (onlineUsers.delete(socket.id)) {
            console.log(`[disconnect] User removed from online users map`);
            broadcastOnlineUsers(io);
          }
          return;
        }

        console.log(`[disconnect] Handling opponent left for game ${gameId}`);
        await handleOpponentLeft(gameId, userId, io);
      } else {
        console.log(`[disconnect] Not in a game, no action needed`);
      }

      if (onlineUsers.delete(socket.id)) {
        console.log(`[disconnect] User removed from online users map`);
        broadcastOnlineUsers(io);
      }
    });
  });
};
