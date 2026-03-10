import React from 'react';
import { useGame, QuestionLanguage } from '../context/GameContext';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../utils/translations';

interface TopicSelectionProps {
  onTopicSelected: (topic: string) => void;
  onBack: () => void;
}

const TOPICS = [
  'Addition & Subtraction',
  'Multiplication & Division',
  'Fractions & Decimals',
  'Ratios & Percentages',
  'Algebra Equations',
  'Geometry',
  'Word Problems',
  'Coordinate Geometry',
  'Pattern Recognition',
];

export const TopicSelection: React.FC<TopicSelectionProps> = ({ onTopicSelected, onBack }) => {
  const { selectedLanguage, setSelectedLanguage } = useGame();
  const { language } = useLanguage();
  const t = translations[language];

  const config = { bg: 'bg-teal-50', text: 'text-teal-700', button: 'bg-teal-500 hover:bg-teal-600' };

  return (
    <div className="flex flex-col min-h-screen bg-amber-50 animate-fade-in">
      {/* Header */}
      <div className="bg-white shadow-sm px-4 py-6 text-center flex items-center justify-between">
        <button 
          onClick={onBack}
          className="text-cyan-500 hover:text-cyan-600 active:text-cyan-700 font-bold text-base sm:text-lg min-w-[60px] text-left"
        >
          ← {t.back}
        </button>
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Choose a Topic</h1>
        </div>
        <div className="w-[60px]"></div>
      </div>

      {/* Subject info */}
      <div className={`${config.bg} ${config.text} text-center px-4 py-3 text-base sm:text-sm font-semibold`}>
        Practice Topics
      </div>

      <div className="bg-white border-t border-gray-200 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <p className="text-sm font-semibold text-gray-700 mb-3">Question Language:</p>
          <div className="flex gap-3">
            {(['english', 'russian', 'kazakh'] as QuestionLanguage[]).map((lang) => (
              <button
                key={lang}
                onClick={() => setSelectedLanguage(lang)}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${
                  selectedLanguage === lang
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {lang.charAt(0).toUpperCase() + lang.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full overflow-y-auto pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TOPICS.map((topic) => (
            <button
              key={topic}
              onClick={() => onTopicSelected(topic)}
              className={`${config.button} text-white rounded-2xl p-4 text-left shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105`}
            >
              <div className="flex items-center justify-between">
                <span className="text-base font-bold">{topic}</span>
                <span className="text-xl">→</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
