import React, { useMemo, useState } from 'react';

interface OnboardingScreenProps {
  onComplete: () => void;
}

const slides = [
  {
    emoji: '🧠⚡',
    title: 'Welcome to ZerekIQ!',
    subtitle: 'Smart prep for NIS & BIL admission tests',
    bg: 'bg-gradient-to-br from-teal-500 to-teal-600',
  },
  {
    emoji: '🎮',
    title: 'Practice & Compete',
    subtitle: 'Solo practice or challenge friends in real-time multiplayer',
    bg: 'bg-gradient-to-br from-purple-500 to-purple-600',
  },
  {
    emoji: '🏆',
    title: 'Track Your Progress',
    subtitle: 'See your improvement and climb the leaderboard',
    bg: 'bg-gradient-to-br from-blue-500 to-indigo-600',
  },
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const [activeSlide, setActiveSlide] = useState(0);

  const handleFinish = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    localStorage.removeItem('zerekIqJustSignedUp');
    onComplete();
  };

  const handleNext = () => {
    if (activeSlide === slides.length - 1) {
      handleFinish();
      return;
    }
    setActiveSlide((prev) => prev + 1);
  };

  const translateStyle = useMemo(
    () => ({ transform: `translateX(-${activeSlide * 100}%)` }),
    [activeSlide]
  );

  return (
    <div className="min-h-screen bg-amber-50 px-4 py-6 max-w-md mx-auto animate-fade-in">
      <div className="relative h-[84vh] rounded-3xl overflow-hidden shadow-md">
        <button
          onClick={handleFinish}
          className="absolute top-4 right-4 z-10 bg-white/20 backdrop-blur text-white px-4 py-2 rounded-full font-semibold min-h-[44px]"
        >
          Skip
        </button>

        <div className="flex h-full transition-transform duration-500 ease-out" style={translateStyle}>
          {slides.map((slide) => (
            <div key={slide.title} className={`${slide.bg} min-w-full h-full p-6 flex flex-col text-white`}>
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="text-7xl mb-6 animate-pulse">{slide.emoji}</div>
                <h1 className="text-3xl font-bold mb-3">{slide.title}</h1>
                <p className="text-base font-medium text-white/90 max-w-xs">{slide.subtitle}</p>
              </div>

              <div className="space-y-5 pb-2">
                <div className="flex items-center justify-center gap-2">
                  {slides.map((_, index) => (
                    <div
                      key={index}
                      className={`rounded-full transition-all duration-300 ${
                        index === activeSlide ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/60'
                      }`}
                    />
                  ))}
                </div>

                <button
                  onClick={handleNext}
                  className="w-full bg-teal-500 hover:scale-105 transition-transform duration-200 text-white font-bold py-4 rounded-full shadow-sm min-h-[56px]"
                >
                  {activeSlide === slides.length - 1 ? "Let's Start!" : 'Next'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
