import React, { useState, useEffect } from 'react';
import { useApi } from '../utils/api';
import { useGameSocket } from '../hooks/useGameSocket';
import { TopicSelection } from './TopicSelection';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useGame } from '../context/GameContext';
import { translations } from '../utils/translations';

interface Question {
  id: string;
  text: string;
  options: string[];
  difficulty: number;
  explanation?: string | null;
  subject?: string;
}

interface MultiplayerGameProps {
  onBack: () => void;
}

interface OnlineUser {
  userId: string;
  username: string;
}

interface IncomingRequest {
  fromUserId: string;
  fromUsername: string;
  topic: string;
  language?: 'english' | 'russian' | 'kazakh';
}

type GameMode = 'selection' | 'topic' | 'join' | 'random' | 'waiting' | 'playing' | 'completed';
type PendingAction = 'create' | 'join' | 'random' | null;

export const MultiplayerGame: React.FC<MultiplayerGameProps> = ({ onBack }) => {
  const [mode, setMode] = useState<GameMode>('selection');
  const [gameId, setGameId] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [gameStatus, setGameStatus] = useState('');
  const [joinGameId, setJoinGameId] = useState('');
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [gameResult, setGameResult] = useState<any>(null);
  const [timeStarted, setTimeStarted] = useState<number>(0);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [answerExplanation, setAnswerExplanation] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [incomingRequest, setIncomingRequest] = useState<IncomingRequest | null>(null);
  const [requestNotice, setRequestNotice] = useState<string | null>(null);
  const [outgoingRequestTo, setOutgoingRequestTo] = useState<string | null>(null);
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const [opponentLeft, setOpponentLeft] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [visualTimeLeft, setVisualTimeLeft] = useState(30);
  const { request } = useApi();
  const { socket, connected } = useGameSocket();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { subject } = useGame();
  const t = translations[language];

  useEffect(() => {
    console.log('Frontend gameId:', gameId);
  }, [gameId]);

  // Separate effect for socket event listeners - should only depend on socket, not game state
  useEffect(() => {
    if (!socket || !connected) return;

    console.log('[MultiplayerGame] Registering socket event listeners');

    socket.on('player_joined', (data) => {
      setPlayers(data.players);
      if (data.playerCount === 2) {
        setGameStatus('ready');
      }
    });

    socket.on('game_started', (data) => {
      console.log('[MultiplayerGame] game_started event received, listeners should be registered');
      setGameStarted(true);
      setQuestions(data.questions);
      setMode('playing');
      setGameStatus('playing');
      setTimeStarted(Date.now());
    });

    socket.on('answer_submitted', (data) => {
      console.log('Answer submitted:', data);
      if (data.userId === user?.id) {
        if (data.isCorrect) {
          setAnswerExplanation(null);
        } else {
          // Show explanation - will be set based on current state in render
          setAnswerExplanation('loading');
        }
      }
    });

    socket.on('round_result', (data) => {
      console.log('[MultiplayerGame] round_result received:', data);
      console.log('[MultiplayerGame] Round winner:', data.winner);
      // Note: We don't increment currentIndex here anymore
      // The backend will emit next_question event which will handle progression
    });

    socket.on('next_question', (data) => {
      console.log('[MultiplayerGame] next_question received:', data);
      setCurrentIndex(data.questionIndex);
      setSelectedAnswer(null);
      setTimeStarted(Date.now());
      setAnswerExplanation(null);
    });

    socket.on('game_ended', (data) => {
      setGameResult(data);
      setMode('completed');
    });

    socket.on('online_users', (data) => {
      setOnlineUsers(data);
    });

    socket.on('game_request_received', (data) => {
      setIncomingRequest(data);
    });

    socket.on('game_request_declined', () => {
      setRequestNotice('Request declined');
      setOutgoingRequestTo(null);
    });

    socket.on('game_request_failed', (data) => {
      setRequestNotice(data?.message || 'Request failed');
      setOutgoingRequestTo(null);
    });

    socket.on('game_request_accepted', (data) => {
      setGameId(data.gameId);
      setSelectedTopic(data.topic);
      setMode('waiting');
      setIncomingRequest(null);
      setOutgoingRequestTo(null);
      socket.emit('update_user_status', 'in-game');
      socket.emit('join_game', data.gameId);
    });

    socket.on('error', (error) => {
      alert(error);
    });

    return () => {
      console.log('[MultiplayerGame] Cleaning up socket event listeners');
      socket.off('player_joined');
      socket.off('game_started');
      socket.off('answer_submitted');
      socket.off('round_result');
      socket.off('next_question');
      socket.off('game_ended');
      socket.off('online_users');
      socket.off('game_request_received');
      socket.off('game_request_declined');
      socket.off('game_request_failed');
      socket.off('game_request_accepted');
      socket.off('error');
    };
  }, [socket, connected, user?.id]);

  useEffect(() => {
    socket?.off('opponent_left');
  }, []);

  useEffect(() => {
    if (!socket) return;
    if (!gameId) return;

    setOpponentLeft(false);
    console.log('Registering opponent_left for confirmed gameId:', gameId);

    socket.off('opponent_left');
    socket.on('opponent_left', (data: { gameId?: string; result?: string; message?: string }) => {
      console.log('opponent_left received:', data, 'current gameId:', gameId);
      if (data.gameId === gameId) {
        setOpponentLeft(true);
      }
    });

    return () => {
      socket.off('opponent_left');
      setOpponentLeft(false);
    };
  }, [gameId, socket]);

  useEffect(() => {
    setOpponentLeft(false);
    return () => {
      setOpponentLeft(false);
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    return () => {
      if (!gameStarted || !gameId) {
        return;
      }
      socket.emit('leave_game', { gameId });
    };
  }, [socket, gameStarted, gameId]);

  useEffect(() => {
    if (mode !== 'playing') return;
    setVisualTimeLeft(30);

    const timer = setInterval(() => {
      setVisualTimeLeft((prev) => (prev <= 1 ? 30 : prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [mode, currentIndex]);

  const createGame = async (topic: string) => {
    setOpponentLeft(false);
    setGameStarted(false);
    if (!subject) {
      alert('Subject not selected');
      return;
    }
    setLoading(true);
    try {
      const data = await request('/games/multiplayer/create', {
        method: 'POST',
        body: JSON.stringify({ topic, language, subject }),
      });
      setGameId(data.gameId);
      setMode('waiting');
      socket?.emit('update_user_status', 'in-game');
      socket?.emit('join_game', data.gameId);
    } catch (error: any) {
      // Log error for debugging on frontend console
      console.error('Failed to create game:', error);
      // Show user-friendly message instead of technical error
      alert('Unable to create game. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const joinGame = async () => {
    setOpponentLeft(false);
    setGameStarted(false);
    if (!joinGameId.trim()) {
      alert('Please enter a game ID');
      return;
    }

    if (selectedTopic === null || subject === null) {
      alert('Please select a topic and subject first');
      return;
    }

    setLoading(true);
    try {
      const data = await request(`/games/multiplayer/${joinGameId}/join`, {
        method: 'POST',
        body: JSON.stringify({ topic: selectedTopic, language, subject }),
      });
      setGameId(joinGameId);
      setMode('waiting');
      socket?.emit('update_user_status', 'in-game');
      socket?.emit('join_game', joinGameId);

      if (data.status === 'ready') {
        setQuestions(data.questions);
        setMode('playing');
        setGameStatus('playing');
        setTimeStarted(Date.now());
      }
    } catch (error: any) {
      // Log error for debugging on frontend console
      console.error('Failed to join game:', error);
      // Show user-friendly message instead of technical error
      alert('Unable to join game. Please check the game ID and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSubmit = (answerIndex: number) => {
    if (loading || !socket) return;

    setSelectedAnswer(answerIndex);

    const timeToAnswer = Math.round((Date.now() - timeStarted) / 1000);
    const currentQuestion = questions[currentIndex];

    console.log('[MultiplayerGame] Submitting answer:', {
      gameId,
      questionId: currentQuestion.id,
      questionIndex: currentIndex,
      selectedAnswer: answerIndex,
      timeToAnswer,
    });

    socket.emit('submit_answer', {
      gameId,
      questionId: currentQuestion.id,
      selectedAnswer: answerIndex,
      timeToAnswer,
    });
  };

  const handleSendRequest = (userId: string) => {
    if (!socket) return;
    if (selectedTopic === null) {
      alert('Please select a topic first');
      return;
    }
    setOutgoingRequestTo(userId);
    socket.emit('send_game_request', { toUserId: userId, topic: selectedTopic, language });
  };

  const handleAcceptRequest = () => {
    if (!socket || !incomingRequest) return;
    socket.emit('accept_game_request', {
      fromUserId: incomingRequest.fromUserId,
      topic: incomingRequest.topic,
      language: incomingRequest.language || language,
    });
  };

  const handleDeclineRequest = () => {
    if (!socket || !incomingRequest) return;
    socket.emit('decline_game_request', { fromUserId: incomingRequest.fromUserId });
    setIncomingRequest(null);
  };

  const handleSelectGameAction = (action: PendingAction) => {
    setOpponentLeft(false);
    setGameStarted(false);
    setPendingAction(action);
    setMode('topic');
  };

  const handleQuit = () => {
    if (gameStarted && socket && gameId) {
      socket.emit('leave_game', { gameId });
    }
    setShowQuitDialog(false);
    setTimeout(() => onBack(), 300);
  };

  const handleBackFromWaiting = () => {
    socket?.emit('update_user_status', 'available');
    onBack();
  };

  const incomingRequestModal = incomingRequest ? (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center px-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-sm">
        <p className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 text-center">
          👥 {incomingRequest.fromUsername}
        </p>
        <p className="text-gray-600 text-center mb-6 text-base">
          wants to play with you!
        </p>
        <div className="bg-cyan-50 rounded-xl p-4 mb-6 text-center">
          <p className="text-base sm:text-sm text-gray-600">Topic</p>
          <p className="text-xl sm:text-2xl font-bold text-cyan-600">{incomingRequest.topic}</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleDeclineRequest}
            className="flex-1 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-bold py-4 rounded-xl transition-colors text-base min-h-[56px]"
          >
            Decline
          </button>
          <button 
            onClick={handleAcceptRequest}
            className="flex-1 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-bold py-4 rounded-xl transition-colors text-base min-h-[56px]"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (mode === 'selection') {
    return (
      <div className="flex flex-col min-h-screen bg-amber-50">
        {/* Header */}
        <div className="bg-white shadow-sm px-4 py-6 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">🎮 Multiplayer</h1>
          <p className="text-gray-500 text-base sm:text-sm mt-2">Challenge other players</p>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-md mx-auto w-full">
          {/* Notice */}
          {requestNotice && (
            <div className="w-full bg-yellow-100 border-2 border-yellow-400 text-yellow-800 px-4 py-3 rounded-xl mb-6 text-base sm:text-sm font-semibold">
              {requestNotice}
            </div>
          )}

          {/* Action Buttons */}
          <div className="w-full flex flex-col gap-4 mb-8">
            <button
              onClick={() => handleSelectGameAction('create')}
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 active:from-green-700 active:to-green-800 text-white rounded-2xl py-6 sm:py-8 px-4 text-center transition-all shadow-md disabled:opacity-75 min-h-[140px]"
            >
              <div className="text-5xl sm:text-4xl mb-2">⚙️</div>
              <h2 className="text-xl sm:text-2xl font-bold">{loading ? 'Creating...' : 'Create Game'}</h2>
              <p className="text-base sm:text-sm mt-2 text-green-100">Start a new game room</p>
            </button>

            <button
              onClick={() => handleSelectGameAction('join')}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 active:from-blue-700 active:to-blue-800 text-white rounded-2xl py-6 sm:py-8 px-4 text-center transition-all shadow-md min-h-[140px]"
            >
              <div className="text-5xl sm:text-4xl mb-2">🎟️</div>
              <h2 className="text-xl sm:text-2xl font-bold">Join Game</h2>
              <p className="text-base sm:text-sm mt-2 text-blue-100">Enter a Game ID</p>
            </button>

            <button
              onClick={() => handleSelectGameAction('random')}
              className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 active:from-purple-700 active:to-purple-800 text-white rounded-2xl py-6 sm:py-8 px-4 text-center transition-all shadow-md min-h-[140px]"
            >
              <div className="text-5xl sm:text-4xl mb-2">🎲</div>
              <h2 className="text-xl sm:text-2xl font-bold">Play Random</h2>
              <p className="text-base sm:text-sm mt-2 text-purple-100">Find a random opponent</p>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-gray-200 px-4 py-4">
          <div className="max-w-md mx-auto">
            <button 
              onClick={onBack}
              className="w-full bg-gray-300 hover:bg-gray-400 active:bg-gray-500 text-gray-900 font-bold py-4 rounded-2xl transition-colors text-base min-h-[56px]"
            >
              ← Back
            </button>
          </div>
        </div>

        {incomingRequestModal}
      </div>
    );
  }

  if (mode === 'topic') {
    return (
      <>
        <TopicSelection
          onTopicSelected={(topic) => {
            setSelectedTopic(topic);
            if (pendingAction === 'create') {
              createGame(topic);
            } else if (pendingAction === 'random') {
              setMode('random');
            } else {
              setMode('join');
            }
          }}
          onBack={() => {
            setPendingAction(null);
            setMode('selection');
          }}
        />
        {incomingRequestModal}
      </>
    );
  }

  if (mode === 'random') {
    return (
      <div className="flex flex-col min-h-screen bg-amber-50">
        {/* Header */}
        <div className="bg-white shadow-sm px-4 py-6 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Play Random</h1>
          <p className="text-gray-500 text-base sm:text-sm mt-2">Find an opponent</p>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-md mx-auto w-full">
          {requestNotice && (
            <div className="w-full bg-yellow-100 border-2 border-yellow-400 text-yellow-800 px-4 py-3 rounded-xl mb-6 text-base">
              {requestNotice}
            </div>
          )}

          {onlineUsers.length === 0 ? (
            <div className="w-full bg-white rounded-2xl shadow-md p-8 text-center">
              <div className="text-5xl sm:text-6xl mb-4">😴</div>
              <p className="text-gray-600 mb-6 text-base">No players online right now.</p>
              <button
                onClick={() => setMode('selection')}
                className="w-full bg-gray-300 hover:bg-gray-400 active:bg-gray-500 text-gray-900 font-bold py-4 rounded-2xl transition-colors min-h-[56px]"
              >
                ← Back
              </button>
            </div>
          ) : (
            <>
              <div className="w-full space-y-3 mb-8">
                {onlineUsers.map((user) => (
                  <div key={user.userId} className="bg-white rounded-2xl shadow-md p-4 sm:p-5 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
                        👤
                      </div>
                      <span className="font-semibold text-gray-900 text-base">{user.username}</span>
                    </div>
                    <button
                      onClick={() => handleSendRequest(user.userId)}
                      disabled={outgoingRequestTo === user.userId}
                      className={`px-4 sm:px-6 py-3 rounded-full font-bold text-base transition-colors min-h-[48px] ${
                        outgoingRequestTo === user.userId
                          ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                          : 'bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700 text-white'
                      }`}
                    >
                      {outgoingRequestTo === user.userId ? 'Requesting...' : 'Play'}
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setMode('selection')}
                className="w-full bg-gray-300 hover:bg-gray-400 active:bg-gray-500 text-gray-900 font-bold py-4 rounded-2xl transition-colors min-h-[56px]"
              >
                ← Back
              </button>
            </>
          )}
        </div>

        {incomingRequestModal}
      </div>
    );
  }

  if (mode === 'join') {
    return (
      <div className="flex flex-col min-h-screen bg-amber-50">
        {/* Header */}
        <div className="bg-white shadow-sm px-4 py-6 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Join Game</h1>
          <p className="text-gray-500 text-base sm:text-sm mt-2">Enter a Game ID</p>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-md mx-auto w-full">
          <div className="w-full bg-white rounded-2xl shadow-md p-6 sm:p-8">
            <input
              type="text"
              placeholder="Enter Game ID"
              value={joinGameId}
              onChange={(e) => setJoinGameId(e.target.value)}
              className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400 mb-6 text-base"
            />
            <button
              onClick={joinGame}
              disabled={loading}
              className="w-full bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700 text-white font-bold py-4 sm:py-5 rounded-2xl text-lg transition-colors disabled:opacity-75 mb-3 min-h-[56px]"
            >
              {loading ? 'Joining...' : 'Join'}
            </button>
            <button
              onClick={() => setMode('selection')}
              className="w-full bg-gray-300 hover:bg-gray-400 active:bg-gray-500 text-gray-900 font-bold py-4 rounded-2xl transition-colors min-h-[56px]"
            >
              ← Back
            </button>
          </div>
        </div>

        {incomingRequestModal}
      </div>
    );
  }

  if (mode === 'waiting') {
    return (
      <div className="flex flex-col min-h-screen bg-amber-50">
        {/* Header */}
        <div className="bg-white shadow-sm px-4 py-6 text-center">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Waiting for Opponent...</h1>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-md mx-auto w-full">
          <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 text-center w-full">
            {/* Game ID */}
            <div className="mb-6">
              <p className="text-base sm:text-sm text-gray-500 uppercase mb-2 font-semibold">Game ID</p>
              <div className="bg-gray-100 text-gray-900 font-bold text-xl sm:text-2xl py-4 px-4 rounded-xl break-all">
                {gameId}
              </div>
            </div>

            {selectedTopic !== null && (
              <div className="mb-6 p-4 bg-cyan-50 rounded-xl">
                <p className="text-base sm:text-sm text-gray-600 mb-1">Topic</p>
                <p className="text-xl sm:text-2xl font-bold text-cyan-600">{selectedTopic}</p>
              </div>
            )}

            {/* Players */}
            <div className="mb-6">
              <p className="text-base sm:text-sm text-gray-500 uppercase mb-4 font-semibold">Players ({players.length}/2)</p>
              {players.length > 0 ? (
                <ul className="space-y-3">
                  {players.map((p) => (
                    <li key={p.id} className="bg-cyan-50 text-cyan-900 font-semibold p-4 rounded-xl text-base">
                      👤 {p.username}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 text-base">Waiting for players to join...</p>
              )}
            </div>

            {/* Loading animation */}
            <div className="flex justify-center gap-1 mb-6">
              <div className="w-3 h-3 bg-cyan-500 rounded-full animate-bounce"></div>
              <div className="w-3 h-3 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-3 h-3 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>

            <p className="text-gray-600 mb-6 text-base">Finding opponent...</p>

            <button
              onClick={handleBackFromWaiting}
              className="w-full bg-gray-300 hover:bg-gray-400 active:bg-gray-500 text-gray-900 font-bold py-4 rounded-2xl transition-colors min-h-[56px]"
            >
              ← Back
            </button>
          </div>
        </div>

        {incomingRequestModal}
      </div>
    );
  }

  if (mode === 'completed' && gameResult) {
    const { winnerName, loserName, winnerScore, loserScore } = gameResult;
    const isCurrentUserWinner = user?.username === winnerName;
    
    return (
      <div className="flex flex-col min-h-screen bg-amber-50 items-center justify-center px-4 py-8">
        <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-6 sm:p-8 text-center">
          <div className="text-6xl sm:text-7xl mb-4">{isCurrentUserWinner ? '🏆' : '💪'}</div>
          <h1 className={`text-2xl sm:text-3xl font-bold mb-6 ${
            isCurrentUserWinner ? 'text-green-600' : 'text-cyan-600'
          }`}>
            {isCurrentUserWinner ? 'You Won!' : 'Game Over!'}
          </h1>
          
          {/* Winner card */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-400 rounded-2xl p-6 mb-4">
            <p className="text-base sm:text-sm text-green-600 font-bold mb-2">🥇 WINNER</p>
            <h2 className="text-xl sm:text-2xl font-bold text-green-700 mb-2">{winnerName}</h2>
            <p className="text-4xl sm:text-5xl font-bold text-green-600">{winnerScore}%</p>
          </div>

          {/* Loser card */}
          <div className="bg-gray-100 rounded-2xl p-6 mb-8">
            <p className="text-base sm:text-sm text-gray-600 font-bold mb-2">Second Place</p>
            <h3 className="text-lg sm:text-xl font-bold text-gray-700 mb-2">{loserName}</h3>
            <p className="text-2xl sm:text-3xl font-bold text-gray-600">{loserScore}%</p>
          </div>

          <button 
            onClick={() => {
              socket?.emit('update_user_status', 'available');
              onBack();
            }} 
            className="w-full bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700 text-white font-bold py-4 sm:py-5 rounded-2xl text-lg sm:text-xl transition-colors min-h-[56px]"
          >
            Back to Menu
          </button>
        </div>
        {incomingRequestModal}
      </div>
    );
  }

  // Victory popup for when opponent quits
  const victoryPopup = opponentLeft ? (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 text-center mx-4">
        <div className="text-6xl mb-4">🏆</div>
        <h2 className="text-2xl font-bold text-green-600 mb-2">
          You Win!
        </h2>
        <p className="text-gray-600 mb-6">
          Your opponent left the game
        </p>
        <button
          onClick={() => onBack()}
          className="w-full bg-teal-500 text-white py-4 rounded-2xl text-lg font-bold"
        >
          Go Home
        </button>
      </div>
    </div>
  ) : null;

  // Quit confirmation dialog
  const quitDialog = showQuitDialog ? (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center px-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-sm">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Quit Game?</h2>
        <p className="text-gray-600 mb-6">Are you sure you want to quit? Your opponent will win.</p>
        
        <div className="flex gap-3">
          <button 
            onClick={() => setShowQuitDialog(false)}
            className="flex-1 bg-gray-300 hover:bg-gray-400 active:bg-gray-500 text-gray-900 font-bold py-4 rounded-xl transition-colors text-base min-h-[48px]"
          >
            Cancel
          </button>
          <button 
            onClick={handleQuit}
            className="flex-1 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-bold py-4 rounded-xl transition-colors text-base min-h-[48px]"
          >
            Yes, Quit
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const currentQuestion = questions[currentIndex];

  if (mode === 'playing' && currentQuestion) {
    const progressPercent = ((currentIndex + 1) / questions.length) * 100;
    const timerColor = visualTimeLeft > 20 ? '#22c55e' : visualTimeLeft > 10 ? '#f59e0b' : '#ef4444';
    const circumference = 2 * Math.PI * 26;
    const timerStrokeDashoffset = circumference - (visualTimeLeft / 30) * circumference;

    return (
      <div className="flex flex-col min-h-screen bg-amber-50 pb-24 animate-fade-in">
        <div className="bg-white shadow-md px-4 py-4">
          <div className="max-w-md mx-auto grid grid-cols-3 items-center gap-2">
            <div>
              <p className="text-sm font-bold text-gray-900">Q {currentIndex + 1} / {questions.length}</p>
              <div className="bg-gray-200 rounded-full h-2 mt-2">
                <div className="bg-teal-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>

            <div className="flex justify-center">
              <div className="relative w-16 h-16">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="26" stroke="#e5e7eb" strokeWidth="6" fill="none" />
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    stroke={timerColor}
                    strokeWidth="6"
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={timerStrokeDashoffset}
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-900">{visualTimeLeft}</div>
              </div>
            </div>

            <div className="text-right">
              <p className="text-xs text-gray-400">Status</p>
              <p className="text-sm font-bold text-teal-500 capitalize">{gameStatus}</p>
              <button
                onClick={() => setShowQuitDialog(true)}
                className="mt-2 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs transition-colors min-h-[32px]"
              >
                🚪 Quit
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 px-4 py-6 max-w-md mx-auto w-full space-y-4">
          <div className={`bg-white rounded-2xl shadow-md p-5 text-center border-t-4 ${
            currentQuestion.subject === 'logic' ? 'border-purple-500' : 'border-teal-500'
          }`}>
            <span className={`inline-flex px-3 py-1 rounded-full text-sm text-white font-bold mb-4 ${
              currentQuestion.subject === 'logic' ? 'bg-purple-500' : 'bg-teal-500'
            }`}>
              {currentQuestion.subject === 'logic' ? '🧠 Logic' : '🔢 Math'}
            </span>
            <h2 className="text-xl font-semibold text-gray-900 min-h-[150px] flex items-center justify-center leading-relaxed">
              {currentQuestion.text}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswerSubmit(index)}
                disabled={selectedAnswer !== null}
                className={`rounded-2xl border-2 transition-all duration-200 min-h-[64px] p-3 text-left flex items-center gap-3 ${
                  selectedAnswer === index
                    ? 'bg-teal-500 text-white border-teal-500'
                    : 'bg-white text-gray-900 border-gray-300 hover:border-teal-400'
                } ${selectedAnswer !== null ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
              >
                <span className="w-8 h-8 rounded-full bg-black/10 text-sm font-bold flex items-center justify-center">
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="text-sm font-semibold leading-snug">{option}</span>
              </button>
            ))}
          </div>

          {answerExplanation && (
            <div className="bg-amber-100 border border-amber-300 rounded-2xl p-4 w-full transition-all duration-300">
              <p className="font-bold text-amber-900 mb-2">💡 Explanation:</p>
              <p className="text-yellow-800 text-base sm:text-sm leading-relaxed">
                {answerExplanation === 'loading' ? currentQuestion?.explanation : answerExplanation}
              </p>
            </div>
          )}
        </div>

        {incomingRequestModal}
        {victoryPopup}
        {quitDialog}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-amber-50 items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 sm:p-12 text-center max-w-md w-full">
        <div className="text-5xl sm:text-6xl mb-4">⚡</div>
        <p className="text-xl sm:text-2xl font-bold text-gray-900">Loading multiplayer game...</p>
        <div className="mt-6 flex justify-center gap-1">
          <div className="w-3 h-3 bg-cyan-500 rounded-full animate-bounce"></div>
          <div className="w-3 h-3 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-3 h-3 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
      {incomingRequestModal}
    </div>
  );
};
