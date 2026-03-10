import React from 'react';
import { Subject } from '../context/GameContext';

interface SubjectSelectionProps {
  onSubjectSelected?: (subject: Subject) => void;
  onBack?: () => void;
}

const SUBJECTS: Array<{ value: Subject; label: string }> = [
  { value: 'mathematics', label: 'Mathematics' },
  { value: 'natural_sciences', label: 'Natural Sciences' },
  { value: 'english_language', label: 'English Language' },
  { value: 'quantitative_aptitude', label: 'Quantitative Aptitude' },
];

export const SubjectSelection: React.FC<SubjectSelectionProps> = ({ onSubjectSelected, onBack }) => {
  return (
    <div className="min-h-screen bg-amber-50 px-4 py-8">
      <div className="max-w-xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-6">Choose Subject</h1>
        <div className="space-y-3">
          {SUBJECTS.map((subject) => (
            <button
              key={subject.value}
              onClick={() => onSubjectSelected?.(subject.value)}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl p-4 text-left font-semibold"
            >
              {subject.label}
            </button>
          ))}
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="w-full mt-4 bg-white border border-gray-300 text-gray-700 rounded-xl p-3 font-semibold"
          >
            Back
          </button>
        )}
      </div>
    </div>
  );
};
