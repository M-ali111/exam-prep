import React from 'react';
import { useGame, Subject } from '../context/GameContext';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../utils/translations';

interface SubjectSelectionProps {
  onSubjectSelected?: () => void;
  onBack?: () => void;
}

export const SubjectSelection: React.FC<SubjectSelectionProps> = ({ onSubjectSelected, onBack }) => {
  const { subject, setSubject } = useGame();
  const { language } = useLanguage();

  const t = translations[language];

  const handleSelectSubject = (selectedSubject: Subject) => {
    setSubject(selectedSubject);
    onSubjectSelected?.();
  };

  const subjectLabels = {
    math: t.mathematics,
    logic: t.logicIQ,
    english: 'English Language',
  };

  return (
    <div className="flex flex-col min-h-screen bg-amber-50">
      {/* Header */}
      <div className="bg-white shadow-sm px-4 py-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">{t.chooseSubject}</h1>
        <p className="text-gray-500 text-sm mt-2">NIS/BIL Kazakhstan Preparation</p>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-md mx-auto w-full">
        {/* Subject Cards Grid */}
        <div className="grid grid-cols-1 gap-4 w-full mb-6">
          {(['math', 'logic', 'english'] as const).map((subj) => (
            <button
              key={subj}
              onClick={() => handleSelectSubject(subj)}
              className={`p-6 rounded-2xl transition-all duration-200 flex flex-col items-center gap-3 shadow-md border-2 ${
                subject === subj
                  ? subj === 'math'
                    ? 'bg-blue-50 border-blue-500 scale-105'
                    : subj === 'logic'
                    ? 'bg-purple-50 border-purple-500 scale-105'
                    : 'bg-amber-50 border-amber-500 scale-105'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-4xl">{subj === 'math' ? '🔢' : subj === 'logic' ? '🧠' : '📚'}</div>
              <div className="text-center">
                <h3 className={`text-lg font-bold ${
                  subject === subj
                    ? subj === 'math' ? 'text-blue-600' : subj === 'logic' ? 'text-purple-600' : 'text-amber-600'
                    : 'text-gray-900'
                }`}>
                  {subjectLabels[subj]}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {subj === 'math' ? 'Algebra, Geometry, Arithmetic' : subj === 'logic' ? 'Puzzles, Reasoning, IQ' : 'Grammar, Reading, Vocabulary'}
                </p>
              </div>
              {subject === subj && (
                <div className="text-cyan-500 font-bold text-sm mt-1">✓ Selected</div>
              )}
            </button>
          ))}
        </div>

        {/* Continue Button */}
        {subject && (
          <button
            onClick={() => handleSelectSubject(subject)}
            className={`w-full rounded-2xl py-4 px-4 text-white font-bold text-lg transition-colors mb-3 ${
              subject === 'math'
                ? 'bg-blue-500 hover:bg-blue-600'
                : subject === 'logic'
                ? 'bg-purple-500 hover:bg-purple-600'
                : 'bg-amber-500 hover:bg-amber-600'
            }`}
          >
            Continue with {subjectLabels[subject]}
          </button>
        )}

        {/* Back Button */}
        {onBack && (
          <button 
            onClick={onBack} 
            className="w-full bg-white border-2 border-gray-300 text-gray-700 rounded-2xl py-3 px-4 font-bold text-lg hover:bg-gray-50 transition-colors"
          >
            ← Back to Menu
          </button>
        )}
      </div>
    </div>
  );
};
