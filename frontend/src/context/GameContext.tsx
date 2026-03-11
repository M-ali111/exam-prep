import React, { createContext, useContext, useMemo, useState, useCallback, ReactNode } from 'react';

export type Subject =
  | 'mathematics'
  | 'natural_sciences'
  | 'english_language'
  | 'quantitative_aptitude'
  | 'bil_mathematics_logic'
  | 'bil_kazakh_language'
  | 'bil_history_kazakhstan'
  | 'ielts_reading'
  | 'ielts_writing_skills'
  | 'ielts_vocabulary'
  | 'unt_reading_literacy'
  | 'unt_math_literacy'
  | 'unt_history_kazakhstan'
  | 'unt_profile_math'
  | 'unt_profile_physics';
export type GameMode = 'solo' | 'multiplayer';
export type GameFlowStep = 'subject' | 'mode' | 'language' | 'playing';
export type QuestionLanguage = 'english' | 'russian' | 'kazakh';

interface GameContextType {
  subject: Subject | null;
  setSubject: (subject: Subject) => void;
  selectedMode: GameMode | null;
  setSelectedMode: (mode: GameMode) => void;
  selectedLanguage: QuestionLanguage;
  setSelectedLanguage: (language: QuestionLanguage) => void;
  currentStep: GameFlowStep;
  setCurrentStep: (step: GameFlowStep) => void;
  resetGameFlow: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

const SUBJECT_STORAGE_KEY = 'selectedSubject';
const LANGUAGE_STORAGE_KEY = 'selectedLanguage';

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [subject, setSubjectState] = useState<Subject | null>(() => {
    const stored = localStorage.getItem(SUBJECT_STORAGE_KEY) as Subject | null;
    const validSubjects: Subject[] = [
      'mathematics',
      'natural_sciences',
      'english_language',
      'quantitative_aptitude',
      'bil_mathematics_logic',
      'bil_kazakh_language',
      'bil_history_kazakhstan',
      'ielts_reading',
      'ielts_writing_skills',
      'ielts_vocabulary',
      'unt_reading_literacy',
      'unt_math_literacy',
      'unt_history_kazakhstan',
      'unt_profile_math',
      'unt_profile_physics',
    ];
    return stored && validSubjects.includes(stored) ? stored : null;
  });
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);
  const [selectedLanguage, setSelectedLanguageState] = useState<QuestionLanguage>(() => {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY) as QuestionLanguage | null;
    const validLanguages = ['english', 'russian', 'kazakh'];
    return stored && validLanguages.includes(stored) ? stored : 'english';
  });
  const [currentStep, setCurrentStep] = useState<GameFlowStep>('subject');

  console.log('[GameProvider] Mounted - subject:', subject);

  const setSubject = useCallback((next: Subject) => {
    setSubjectState(next);
    localStorage.setItem(SUBJECT_STORAGE_KEY, next);
  }, []);

  const setSelectedLanguage = useCallback((language: QuestionLanguage) => {
    setSelectedLanguageState(language);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, []);

  const resetGameFlow = useCallback(() => {
    setSelectedMode(null);
    setCurrentStep('subject');
  }, []);

  const value = useMemo(
    () => ({
      subject,
      setSubject,
      selectedMode,
      setSelectedMode,
      selectedLanguage,
      setSelectedLanguage,
      currentStep,
      setCurrentStep,
      resetGameFlow,
    }),
    [subject, setSubject, selectedMode, selectedLanguage, setSelectedLanguage, currentStep, resetGameFlow]
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
