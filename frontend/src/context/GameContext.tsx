import React, { createContext, useContext, useMemo, useState, useCallback, ReactNode } from 'react';

export type Subject = 'math' | 'logic' | 'english';
export type GameMode = 'solo' | 'multiplayer';
export type Grade = 1 | 2 | 3;
export type GameFlowStep = 'subject' | 'mode' | 'grade' | 'language' | 'playing';

interface GameContextType {
  subject: Subject | null;
  setSubject: (subject: Subject) => void;
  selectedMode: GameMode | null;
  setSelectedMode: (mode: GameMode) => void;
  selectedGrade: Grade | null;
  setSelectedGrade: (grade: Grade) => void;
  currentStep: GameFlowStep;
  setCurrentStep: (step: GameFlowStep) => void;
  resetGameFlow: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

const SUBJECT_STORAGE_KEY = 'selectedSubject';

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [subject, setSubjectState] = useState<Subject | null>(() => {
    const stored = localStorage.getItem(SUBJECT_STORAGE_KEY) as Subject | null;
    return stored === 'math' || stored === 'logic' ? stored : null;
  });
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);
  const [currentStep, setCurrentStep] = useState<GameFlowStep>('subject');

  console.log('[GameProvider] Mounted - subject:', subject);

  const setSubject = useCallback((next: Subject) => {
    setSubjectState(next);
    localStorage.setItem(SUBJECT_STORAGE_KEY, next);
  }, []);

  const resetGameFlow = useCallback(() => {
    setSelectedMode(null);
    setSelectedGrade(null);
    setCurrentStep('subject');
  }, []);

  const value = useMemo(
    () => ({
      subject,
      setSubject,
      selectedMode,
      setSelectedMode,
      selectedGrade,
      setSelectedGrade,
      currentStep,
      setCurrentStep,
      resetGameFlow,
    }),
    [subject, setSubject, selectedMode, selectedGrade, currentStep, resetGameFlow]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    console.error('[useGame] Called outside GameProvider! Context is undefined.');
    throw new Error('useGame must be used within a GameProvider');
  }
  console.log('[useGame] Hook called, subject:', context.subject);
  return context;
};
