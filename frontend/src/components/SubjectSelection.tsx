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
    physics: t.physics,
    chemistry: t.chemistry,
    biology: t.biology,
    geography: t.geography,
    history: t.history,
    informatics: t.informatics,
  };

  const subjectIcons = {
    math: '🔢',
    logic: '🧠',
    english: '📚',
    physics: '⚛️',
    chemistry: '🧪',
    biology: '🧬',
    geography: '🌍',
    history: '📜',
    informatics: '💻',
  };

  const subjectDescriptions = {
    math: 'Algebra, Geometry, Arithmetic',
    logic: 'Puzzles, Reasoning, IQ',
    english: 'Grammar, Reading, Vocabulary',
    physics: 'Mechanics, Energy, Forces',
    chemistry: 'Elements, Reactions, Compounds',
    biology: 'Life Science, Cells, Organisms',
    geography: 'Earth, Maps, Regions',
    history: 'World & Kazakhstan History',
    informatics: 'Algorithms, Coding, Logic',
  };

  const subjectColors = {
    math: { bg: 'bg-blue-50', border: 'border-blue-500', text: 'text-blue-600', button: 'bg-blue-500 hover:bg-blue-600' },
    logic: { bg: 'bg-purple-50', border: 'border-purple-500', text: 'text-purple-600', button: 'bg-purple-500 hover:bg-purple-600' },
    english: { bg: 'bg-amber-50', border: 'border-amber-500', text: 'text-amber-600', button: 'bg-amber-500 hover:bg-amber-600' },
    physics: { bg: 'bg-indigo-50', border: 'border-indigo-500', text: 'text-indigo-600', button: 'bg-indigo-500 hover:bg-indigo-600' },
    chemistry: { bg: 'bg-green-50', border: 'border-green-500', text: 'text-green-600', button: 'bg-green-500 hover:bg-green-600' },
    biology: { bg: 'bg-teal-50', border: 'border-teal-500', text: 'text-teal-600', button: 'bg-teal-500 hover:bg-teal-600' },
    geography: { bg: 'bg-cyan-50', border: 'border-cyan-500', text: 'text-cyan-600', button: 'bg-cyan-500 hover:bg-cyan-600' },
    history: { bg: 'bg-rose-50', border: 'border-rose-500', text: 'text-rose-600', button: 'bg-rose-500 hover:bg-rose-600' },
    informatics: { bg: 'bg-slate-50', border: 'border-slate-500', text: 'text-slate-600', button: 'bg-slate-500 hover:bg-slate-600' },
  };

  return (
    <div className="flex flex-col min-h-screen bg-amber-50">
      {/* Header */}
      <div className="bg-white shadow-sm px-4 py-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">{t.chooseSubject}</h1>
        <p className="text-gray-500 text-sm mt-2">NIS/BIL Kazakhstan Preparation</p>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-4xl mx-auto w-full">
        {/* Subject Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full mb-6">
          {(['math', 'logic', 'english', 'physics', 'chemistry', 'biology', 'geography', 'history', 'informatics'] as const).map((subj) => {
            const colors = subjectColors[subj];
            return (
              <button
                key={subj}
                onClick={() => handleSelectSubject(subj)}
                className={`p-6 rounded-2xl transition-all duration-200 flex flex-col items-center gap-3 shadow-md border-2 ${
                  subject === subj
                    ? `${colors.bg} ${colors.border} scale-105`
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-4xl">{subjectIcons[subj]}</div>
                <div className="text-center">
                  <h3 className={`text-lg font-bold ${
                    subject === subj ? colors.text : 'text-gray-900'
                  }`}>
                    {subjectLabels[subj]}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {subjectDescriptions[subj]}
                  </p>
                </div>
                {subject === subj && (
                  <div className="text-cyan-500 font-bold text-sm mt-1">✓ Selected</div>
                )}
              </button>
            );
          })}
        </div>

        {/* Continue Button */}
        {subject && (
          <button
            onClick={() => handleSelectSubject(subject)}
            className={`w-full rounded-2xl py-4 px-4 text-white font-bold text-lg transition-colors mb-3 ${
              subjectColors[subject].button
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
