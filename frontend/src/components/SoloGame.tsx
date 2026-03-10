import React, { useEffect, useMemo, useState } from 'react';
import { useApi } from '../utils/api';
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

interface SoloGameProps {
  onBack: () => void;
}

export const SoloGame: React.FC<SoloGameProps> = ({ onBack }) => {
  const [gameId, setGameId] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [gameResult, setGameResult] = useState<any>(null);
  const [timeStarted, setTimeStarted] = useState<number>(0);
  const [answerExplanation, setAnswerExplanation] = useState<string | null>(null);
  const [awaitingNext, setAwaitingNext] = useState(false);
  const [answerResult, setAnswerResult] = useState<'idle' | 'wrong' | 'correct'>('idle');
  const [revealedCorrectAnswer, setRevealedCorrectAnswer] = useState<number | null>(null);
  const [wrongReviews, setWrongReviews] = useState<Array<{ question: string; correctAnswer: string }>>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [visualTimeLeft, setVisualTimeLeft] = useState(30);
  const [animatedXp, setAnimatedXp] = useState(0);
  const { request } = useApi();
  const { language } = useLanguage();
  const { subject, selectedLanguage } = useGame();
  const t = translations[language];

  useEffect(() => {
    if (subject !== null) {
      startGame(subject);
    }
  }, [subject]);

  useEffect(() => {
    if (!gameStarted || gameCompleted) return;

    setVisualTimeLeft(30);
    const timer = setInterval(() => {
      setVisualTimeLeft((prev) => (prev <= 1 ? 30 : prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStarted, gameCompleted, currentIndex]);

  useEffect(() => {
    if (!gameCompleted || !gameResult) return;

    const targetXp = (gameResult.correctAnswers || 0) * 10;
    if (targetXp <= 0) {
      setAnimatedXp(0);
      return;
    }

    setAnimatedXp(0);
    const step = Math.max(1, Math.ceil(targetXp / 25));
    const interval = setInterval(() => {
      setAnimatedXp((prev) => {
        const next = prev + step;
        if (next >= targetXp) {
          clearInterval(interval);
          return targetXp;
        }
        return next;
      });
    }, 30);

    return () => clearInterval(interval);
  }, [gameCompleted, gameResult]);

  // Calculate derived values at top level (before any conditional returns)
  const currentQuestion = questions[currentIndex];
  const subjectLabel = subject
    ? {
        mathematics: 'Mathematics',
        natural_sciences: 'Natural Sciences',
        english_language: 'English Language',
        quantitative_aptitude: 'Quantitative Aptitude',
      }[subject]
    : 'General';
  const progressPercent = ((currentIndex + 1) / questions.length) * 100;
  const timerColor = visualTimeLeft > 20 ? '#22c55e' : visualTimeLeft > 10 ? '#f59e0b' : '#ef4444';
  const timerStrokeDashoffset = useMemo(() => {
    const circumference = 2 * Math.PI * 26;
    return circumference - (visualTimeLeft / 30) * circumference;
  }, [visualTimeLeft]);

  const startGame = async (selectedSubject: string) => {
    setLoading(true);
    setWrongReviews([]);
    setReviewOpen(false);
    setScore(0);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setAnswerExplanation(null);
    setAwaitingNext(false);
    setAnswerResult('idle');
    setRevealedCorrectAnswer(null);
    setGameCompleted(false);
    setGameResult(null);
    try {
      const data = await request('/games/solo/start', {
        method: 'POST',
        body: JSON.stringify({ subject: selectedSubject, language: selectedLanguage }),
      });
      setGameId(data.gameId);
      setQuestions(data.questions);
      setGameStarted(true);
      setTimeStarted(Date.now());
    } catch (error: any) {
      // Log error for debugging on frontend console
      console.error('Failed to start game:', error);
      // Show user-friendly message instead of technical error
      alert('Unable to start game. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSubmit = async (answerIndex: number) => {
    if (loading) return;

    setLoading(true);
    try {
      const timeToAnswer = Math.round((Date.now() - timeStarted) / 1000);
      const currentQuestion = questions[currentIndex];

      const response = await request(`/games/solo/${gameId}/answer`, {
        method: 'POST',
        body: JSON.stringify({
          questionId: currentQuestion.id,
          selectedAnswer: answerIndex,
          timeToAnswer,
        }),
      });

      if (response.isCorrect) {
        setAnswerResult('correct');
        setScore(score + 1);
        setAnswerExplanation(null);
        setRevealedCorrectAnswer(null);

        if (currentIndex < questions.length - 1) {
          setCurrentIndex(currentIndex + 1);
          setSelectedAnswer(null);
          setAnswerResult('idle');
          setTimeStarted(Date.now());
        } else {
          completeGame();
        }
      } else {
        setAnswerResult('wrong');
        setAnswerExplanation(currentQuestion.explanation || null);
        if (typeof response.correctAnswerIndex === 'number') {
          setRevealedCorrectAnswer(response.correctAnswerIndex);
        }

        const resolvedCorrectAnswer =
          typeof response.correctAnswerIndex === 'number'
            ? currentQuestion.options[response.correctAnswerIndex]
            : response.correctAnswer || currentQuestion.explanation || 'See explanation';

        setWrongReviews((prev) => [
          ...prev,
          {
            question: currentQuestion.text,
            correctAnswer: resolvedCorrectAnswer,
          },
        ]);
        setAwaitingNext(true);
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const completeGame = async () => {
    try {
      const result = await request(`/games/solo/${gameId}/complete`, { method: 'POST' });
      setGameResult(result);
      setGameCompleted(true);

      localStorage.setItem(
        'lastGameSettings',
        JSON.stringify({
          subject: subject ?? 'mathematics',
          language: selectedLanguage,
          mode: 'solo',
        })
      );
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleNextAfterExplanation = () => {
    setAwaitingNext(false);
    setAnswerExplanation(null);
    setAnswerResult('idle');
    setRevealedCorrectAnswer(null);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setTimeStarted(Date.now());
    } else {
      completeGame();
    }
  };



  if (!gameStarted || loading) {
    return (
      <div className="flex flex-col min-h-screen bg-amber-50 items-center justify-center px-4 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-lg p-8 sm:p-12 text-center max-w-md w-full">
          <div className="text-5xl sm:text-6xl mb-4">⚡</div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">Loading game...</p>
          <div className="mt-6 flex justify-center gap-1">
            <div className="w-3 h-3 bg-cyan-500 rounded-full animate-bounce"></div>
            <div className="w-3 h-3 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-3 h-3 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (gameCompleted && gameResult) {
    const percentage = gameResult.score || 0;
    const totalAnswers = gameResult.totalAnswers || 10;
    const correctAnswers = gameResult.correctAnswers || 0;
    const wrongAnswers = Math.max(0, totalAnswers - correctAnswers);
    const scoreColor = percentage >= 70 ? 'text-green-500' : percentage >= 50 ? 'text-amber-500' : 'text-red-500';
    const ringColor = percentage >= 70 ? '#22c55e' : percentage >= 50 ? '#f59e0b' : '#ef4444';
    const emoji = percentage >= 90 ? '🎉' : percentage >= 70 ? '😊' : percentage >= 50 ? '💪' : '📚';
    const title = percentage >= 90 ? 'Outstanding! 🌟' : percentage >= 70 ? 'Great Job! 👏' : percentage >= 50 ? 'Good Effort! 💪' : 'Keep Practicing! 📚';
    const totalXp = correctAnswers * 10;

    const ringStyle = {
      background: `conic-gradient(${ringColor} ${percentage * 3.6}deg, #e5e7eb 0deg)`,
    };
    
    return (
      <div className="flex flex-col min-h-screen bg-amber-50 items-center justify-center px-4 py-6 max-w-md mx-auto pb-24 animate-fade-in">
        <div className="w-full space-y-4">
          <div className="bg-white rounded-2xl shadow-md p-6 text-center hover:shadow-lg transition-shadow duration-200">
            <div className={`text-6xl mb-2 ${percentage >= 90 ? 'animate-confetti' : ''}`}>{emoji}</div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-6 flex items-center justify-center hover:shadow-lg transition-shadow duration-200">
            <div className="w-44 h-44 rounded-full p-2" style={ringStyle}>
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                <span className={`text-4xl font-bold ${scoreColor}`}>{percentage}%</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl shadow-md p-3 text-center">
              <p className="text-xs text-gray-400">✅ Correct</p>
              <p className="text-xl font-bold text-gray-900">{correctAnswers}/{totalAnswers}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-md p-3 text-center">
              <p className="text-xs text-gray-400">❌ Wrong</p>
              <p className="text-xl font-bold text-gray-900">{wrongAnswers}/{totalAnswers}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-md p-3 text-center">
              <p className="text-xs text-gray-400">📚 Subject</p>
              <p className="text-sm font-bold text-gray-900">{subjectLabel}</p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-amber-300 to-yellow-400 rounded-2xl shadow-md p-4 text-center text-amber-900">
            <p className="text-xl font-bold">📈 +{animatedXp} XP Earned!</p>
            <p className="text-sm font-medium mt-1">Final XP: +{totalXp}</p>
          </div>

          {wrongReviews.length > 0 && (
            <div className="bg-white rounded-2xl shadow-md overflow-hidden">
              <button
                onClick={() => setReviewOpen((prev) => !prev)}
                className="w-full text-left p-4 font-bold text-gray-900 flex justify-between items-center min-h-[56px]"
              >
                <span>💡 Review Wrong Answers ({wrongReviews.length})</span>
                <span>{reviewOpen ? '−' : '+'}</span>
              </button>
              {reviewOpen && (
                <div className="px-4 pb-4 space-y-3">
                  {wrongReviews.map((item, index) => (
                    <div key={`${item.question}-${index}`} className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <p className="text-sm font-bold text-gray-900 mb-1">{item.question}</p>
                      <p className="text-sm text-gray-700">Correct: {item.correctAnswer}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={() => {
                if (subject) {
                  startGame(subject);
                }
              }}
              className="w-full bg-teal-500 text-white font-bold rounded-2xl min-h-[56px] text-lg shadow-sm hover:scale-105 transition-transform duration-200"
            >
              🎮 Play Again
            </button>
            <button
              onClick={onBack}
              className="w-full border-2 border-teal-500 text-teal-500 font-bold rounded-2xl min-h-[56px] text-lg shadow-sm hover:scale-105 transition-transform duration-200"
            >
              🏠 Back to Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getOptionClasses = (index: number) => {
    if (awaitingNext && revealedCorrectAnswer === index) {
      return 'bg-green-500 text-white border-green-500';
    }

    if (selectedAnswer === index && awaitingNext && answerResult === 'wrong') {
      return 'bg-red-500 text-white border-red-500';
    }

    if (selectedAnswer === index) {
      return 'bg-teal-500 text-white border-teal-500';
    }

    return 'bg-white text-gray-900 border-gray-300 hover:border-teal-400';
  };

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
                  strokeDasharray={2 * Math.PI * 26}
                  strokeDashoffset={timerStrokeDashoffset}
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-900">{visualTimeLeft}</div>
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs text-gray-400">Score</p>
            <p className="text-xl font-bold text-teal-500">{score}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 max-w-md mx-auto w-full space-y-4">
        {currentQuestion && (
          <>
            <div className="bg-white rounded-2xl shadow-md p-5 text-center border-t-4 border-teal-500">
              <span className="inline-flex px-3 py-1 rounded-full text-sm text-white font-bold mb-4 bg-teal-500">
                🎯 Exam Prep
              </span>
              <h2 className="text-xl font-semibold text-gray-900 min-h-[150px] flex items-center justify-center leading-relaxed">
                {currentQuestion.text}
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setSelectedAnswer(index);
                    handleAnswerSubmit(index);
                  }}
                  disabled={loading || selectedAnswer !== null || awaitingNext}
                  className={`rounded-2xl border-2 transition-all duration-200 min-h-[64px] p-3 text-left flex items-center gap-3 ${getOptionClasses(
                    index
                  )} ${
                    loading || selectedAnswer !== null || awaitingNext
                      ? 'opacity-70 cursor-not-allowed'
                      : 'cursor-pointer hover:scale-105'
                  } ${loading || selectedAnswer !== null || awaitingNext ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span className="w-8 h-8 rounded-full bg-black/10 text-sm font-bold flex items-center justify-center">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="text-sm font-semibold leading-snug">{option}</span>
                  {awaitingNext && revealedCorrectAnswer === index && <span className="ml-auto">✅</span>}
                  {awaitingNext && selectedAnswer === index && answerResult === 'wrong' && <span className="ml-auto">❌</span>}
                </button>
              ))}
            </div>

            {answerExplanation && (
              <div className="bg-amber-100 border border-amber-300 rounded-2xl p-4 w-full transition-all duration-300">
                <p className="font-bold text-amber-900 mb-2">💡 Explanation:</p>
                <p className="text-amber-800 text-sm leading-relaxed">{answerExplanation}</p>
              </div>
            )}

            {awaitingNext && (
              <button 
                onClick={handleNextAfterExplanation} 
                className="w-full bg-teal-500 text-white font-bold py-4 rounded-2xl text-lg shadow-sm min-h-[56px] hover:scale-105 transition-transform duration-200"
              >
                {currentIndex < questions.length - 1 ? 'Next Question →' : 'See Results'}
              </button>
            )}
          </>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 sm:py-4 safe-area-inset-bottom">
        <div className="max-w-md mx-auto">
          <button 
            onClick={onBack} 
            className="w-full bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-bold py-4 rounded-2xl transition-colors text-base sm:text-lg min-h-[56px] shadow-sm"
          >
            Exit Game
          </button>
        </div>
      </div>
    </div>
  );
};
