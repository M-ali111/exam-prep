import React, { useEffect, useState } from 'react';
import { useApi } from '../utils/api';
import { useGameSocket } from '../hooks/useGameSocket';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext';

interface Question {
  id: string;
  text: string;
  options: string[];
  difficulty: number;
  explanation?: string | null;
}

interface MultiplayerGameProps {
  onBack: () => void;
}

interface OnlineUser {
  userId: string;
  username: string;
  status?: 'available' | 'in-game';
}

interface IncomingRequest {
  fromUserId: string;
  fromUsername: string;
  subject: string;
  language?: 'english' | 'russian' | 'kazakh';
}

type GameMode = 'selection' | 'join' | 'random' | 'waiting' | 'playing' | 'completed';

const SUBJECT_LABELS: Record<string, string> = {
  mathematics: 'Mathematics',
  natural_sciences: 'Natural Sciences',
  english_language: 'English Language',
  quantitative_aptitude: 'Quantitative Aptitude',
};

export const MultiplayerGame: React.FC<MultiplayerGameProps> = ({ onBack }) => {
  const [mode, setMode] = useState<GameMode>('selection');
  const [gameId, setGameId] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [gameStatus, setGameStatus] = useState('');
  const [joinGameId, setJoinGameId] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [gameResult, setGameResult] = useState<any>(null);
  const [timeStarted, setTimeStarted] = useState<number>(0);
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
  const { subject, selectedLanguage } = useGame();

  const selectedSubjectLabel = subject ? SUBJECT_LABELS[subject] : 'Unknown Subject';

  useEffect(() => {
    if (!socket || !connected) return;

    socket.on('player_joined', (data) => {
      if (data.playerCount === 2) {
        setGameStatus('ready');
      }
    });

    socket.on('game_started', (data) => {
      setGameStarted(true);
      setQuestions(data.questions);
      setMode('playing');
      setGameStatus('playing');
      setTimeStarted(Date.now());
    });

    socket.on('answer_submitted', (data) => {
      if (data.userId === user?.id && !data.isCorrect) {
        // Intentionally left simple for this mode.
      }
    });

    socket.on('next_question', (data) => {
      setCurrentIndex(data.questionIndex);
      setSelectedAnswer(null);
      setTimeStarted(Date.now());
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
      setMode('waiting');
      setIncomingRequest(null);
      setOutgoingRequestTo(null);
      socket.emit('update_user_status', 'in-game');
      socket.emit('join_game', data.gameId);
    });

    socket.on('opponent_left', (data: { gameId?: string }) => {
      if (data.gameId === gameId) {
        setOpponentLeft(true);
      }
    });

    socket.on('error', (error) => {
      alert(error);
    });

    return () => {
      socket.off('player_joined');
      socket.off('game_started');
      socket.off('answer_submitted');
      socket.off('next_question');
      socket.off('game_ended');
      socket.off('online_users');
      socket.off('game_request_received');
      socket.off('game_request_declined');
      socket.off('game_request_failed');
      socket.off('game_request_accepted');
      socket.off('opponent_left');
      socket.off('error');
    };
  }, [socket, connected, user?.id, gameId]);

  useEffect(() => {
    if (mode !== 'playing') return;
    setVisualTimeLeft(30);

    const timer = setInterval(() => {
      setVisualTimeLeft((prev) => (prev <= 1 ? 30 : prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [mode, currentIndex]);

  const createGame = async () => {
    if (!subject) {
      alert('Please choose a subject first');
      return;
    }

    setLoading(true);
    setOpponentLeft(false);
    setGameStarted(false);

    try {
      const data = await request('/games/multiplayer/create', {
        method: 'POST',
        body: JSON.stringify({ subject, language: selectedLanguage }),
      });
      setGameId(data.gameId);
      setMode('waiting');
      socket?.emit('update_user_status', 'in-game');
      socket?.emit('join_game', data.gameId);
    } catch (error: any) {
      console.error('Failed to create game:', error);
      alert('Unable to create game. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const joinGame = async () => {
    if (!joinGameId.trim()) {
      alert('Please enter a game ID');
      return;
    }

    if (!subject) {
      alert('Please choose a subject first');
      return;
    }

    setLoading(true);
    setOpponentLeft(false);
    setGameStarted(false);

    try {
      const data = await request(`/games/multiplayer/${joinGameId}/join`, {
        method: 'POST',
        body: JSON.stringify({ subject, language: selectedLanguage }),
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
      console.error('Failed to join game:', error);
      alert('Unable to join game. Please check the game ID and subject.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = (toUserId: string) => {
    if (!socket) return;
    if (!subject) {
      alert('Please choose a subject first');
      return;
    }
    setOutgoingRequestTo(toUserId);
    socket.emit('send_game_request', { toUserId, subject, language: selectedLanguage });
  };

  const handleAcceptRequest = () => {
    if (!socket || !incomingRequest) return;
    socket.emit('accept_game_request', {
      fromUserId: incomingRequest.fromUserId,
      subject: incomingRequest.subject,
      language: incomingRequest.language || selectedLanguage,
    });
  };

  const handleDeclineRequest = () => {
    if (!socket || !incomingRequest) return;
    socket.emit('decline_game_request', { fromUserId: incomingRequest.fromUserId });
    setIncomingRequest(null);
  };

  const handleAnswerSubmit = (answerIndex: number) => {
    if (!socket || loading) return;
    setSelectedAnswer(answerIndex);

    const currentQuestion = questions[currentIndex];
    if (!currentQuestion) return;

    const timeToAnswer = Math.round((Date.now() - timeStarted) / 1000);
    socket.emit('submit_answer', {
      gameId,
      questionId: currentQuestion.id,
      selectedAnswer: answerIndex,
      timeToAnswer,
    });
  };

  const handleQuit = () => {
    if (gameStarted && socket && gameId) {
      socket.emit('leave_game', { gameId });
    }
    setShowQuitDialog(false);
    onBack();
  };

  const currentQuestion = questions[currentIndex];

  if (mode === 'selection') {
    return (
      <div className="flex flex-col min-h-screen bg-amber-50">
        <div className="bg-white shadow-sm px-4 py-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Multiplayer</h1>
          <p className="text-gray-500 mt-2">Subject: {selectedSubjectLabel}</p>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-md mx-auto w-full">
          {requestNotice && (
            <div className="w-full bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded-xl mb-4">
              {requestNotice}
            </div>
          )}

          <div className="w-full flex flex-col gap-4 mb-6">
            <button onClick={createGame} disabled={loading} className="w-full bg-green-500 hover:bg-green-600 text-white rounded-2xl py-6 font-bold">
              {loading ? 'Creating...' : 'Create Game'}
            </button>
            <button onClick={() => setMode('join')} className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-2xl py-6 font-bold">
              Join Game
            </button>
            <button onClick={() => setMode('random')} className="w-full bg-purple-500 hover:bg-purple-600 text-white rounded-2xl py-6 font-bold">
              Play Random
            </button>
          </div>

          <button onClick={onBack} className="w-full bg-gray-300 hover:bg-gray-400 text-gray-900 rounded-2xl py-4 font-bold">
            Back
          </button>
        </div>

        {incomingRequest && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center px-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
              <p className="text-xl font-bold text-gray-900 text-center mb-2">{incomingRequest.fromUsername}</p>
              <p className="text-center text-gray-600 mb-4">wants to play</p>
              <p className="text-center font-semibold mb-4">Subject: {SUBJECT_LABELS[incomingRequest.subject] || incomingRequest.subject}</p>
              <div className="flex gap-3">
                <button onClick={handleDeclineRequest} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-3 font-bold">Decline</button>
                <button onClick={handleAcceptRequest} className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-xl py-3 font-bold">Accept</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (mode === 'join') {
    return (
      <div className="flex flex-col min-h-screen bg-amber-50 items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Join Game</h2>
          <input
            type="text"
            placeholder="Enter Game ID"
            value={joinGameId}
            onChange={(e) => setJoinGameId(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl mb-4"
          />
          <button onClick={joinGame} disabled={loading} className="w-full bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl py-3 font-bold mb-3">
            {loading ? 'Joining...' : 'Join'}
          </button>
          <button onClick={() => setMode('selection')} className="w-full bg-gray-300 hover:bg-gray-400 rounded-xl py-3 font-bold text-gray-900">
            Back
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'random') {
    return (
      <div className="flex flex-col min-h-screen bg-amber-50 px-4 py-6">
        <div className="max-w-md mx-auto w-full">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Online Players</h2>
          {onlineUsers.length === 0 ? (
            <div className="bg-white rounded-xl p-4">No players online right now.</div>
          ) : (
            <div className="space-y-3 mb-4">
              {onlineUsers.map((onlineUser) => (
                <div key={onlineUser.userId} className="bg-white rounded-xl p-4 flex justify-between items-center">
                  <span className="font-semibold">{onlineUser.username}</span>
                  <button
                    onClick={() => handleSendRequest(onlineUser.userId)}
                    disabled={outgoingRequestTo === onlineUser.userId || onlineUser.status === 'in-game'}
                    className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg px-4 py-2 font-bold disabled:bg-gray-300"
                  >
                    {outgoingRequestTo === onlineUser.userId ? 'Requesting...' : onlineUser.status === 'in-game' ? 'Busy' : 'Play'}
                  </button>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => setMode('selection')} className="w-full bg-gray-300 hover:bg-gray-400 rounded-xl py-3 font-bold text-gray-900">
            Back
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'waiting') {
    return (
      <div className="flex flex-col min-h-screen bg-amber-50 items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Waiting for Opponent...</h2>
          <p className="text-gray-600 mb-2">Game ID</p>
          <p className="text-xl font-bold text-cyan-600 break-all mb-4">{gameId}</p>
          <p className="text-gray-600 mb-6">Subject: {selectedSubjectLabel}</p>
          <button onClick={onBack} className="w-full bg-gray-300 hover:bg-gray-400 rounded-xl py-3 font-bold text-gray-900">
            Back
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'completed' && gameResult) {
    const isWinner = user?.username === gameResult.winnerName;
    return (
      <div className="flex flex-col min-h-screen bg-amber-50 items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md text-center">
          <h2 className={`text-3xl font-bold mb-4 ${isWinner ? 'text-green-600' : 'text-cyan-600'}`}>
            {isWinner ? 'You Won!' : 'Game Over'}
          </h2>
          <p className="text-gray-700 mb-2">Winner: {gameResult.winnerName} ({gameResult.winnerScore}%)</p>
          <p className="text-gray-700 mb-6">Runner-up: {gameResult.loserName} ({gameResult.loserScore}%)</p>
          <button onClick={onBack} className="w-full bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl py-3 font-bold">
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-amber-50 pb-24 animate-fade-in">
      <div className="bg-white shadow-md px-4 py-4">
        <div className="max-w-md mx-auto grid grid-cols-3 items-center gap-2">
          <div>
            <p className="text-sm font-bold text-gray-900">Q {currentIndex + 1} / {questions.length}</p>
            <div className="bg-gray-200 rounded-full h-2 mt-2">
              <div className="bg-teal-500 h-2 rounded-full transition-all duration-300" style={{ width: `${questions.length ? ((currentIndex + 1) / questions.length) * 100 : 0}%` }} />
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
                  stroke={visualTimeLeft > 10 ? '#22c55e' : '#ef4444'}
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={2 * Math.PI * 26}
                  strokeDashoffset={(2 * Math.PI * 26) - (visualTimeLeft / 30) * (2 * Math.PI * 26)}
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-900">{visualTimeLeft}</div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Status</p>
            <p className="text-sm font-bold text-teal-500 capitalize">{gameStatus}</p>
            <button onClick={() => setShowQuitDialog(true)} className="mt-2 bg-red-500 hover:bg-red-600 text-white rounded-lg px-3 py-1.5 text-xs font-bold">
              Quit
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 max-w-md mx-auto w-full space-y-4">
        {currentQuestion && (
          <>
            <div className="bg-white rounded-2xl shadow-md p-5 text-center border-t-4 border-teal-500">
              <span className="inline-flex px-3 py-1 rounded-full text-sm text-white font-bold mb-4 bg-teal-500">🎯 Exam Prep</span>
              <h2 className="text-xl font-semibold text-gray-900 min-h-[140px] flex items-center justify-center leading-relaxed">
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
          </>
        )}
      </div>

      {opponentLeft && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 text-center mx-4">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="text-2xl font-bold text-green-600 mb-2">You Win!</h2>
            <p className="text-gray-600 mb-6">Your opponent left the game</p>
            <button onClick={onBack} className="w-full bg-teal-500 text-white py-4 rounded-2xl text-lg font-bold">Go Home</button>
          </div>
        </div>
      )}

      {showQuitDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center px-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Quit Game?</h2>
            <p className="text-gray-600 mb-6">Are you sure you want to quit? Your opponent will win.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowQuitDialog(false)} className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 rounded-xl py-3 font-bold">Cancel</button>
              <button onClick={handleQuit} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-3 font-bold">Yes, Quit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
