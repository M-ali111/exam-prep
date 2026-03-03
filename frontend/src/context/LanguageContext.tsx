import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { LanguageCode } from '../utils/translations';

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'language';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>('english');

  console.log('[LanguageProvider] Mounted - language:', language);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
    if (stored === 'english' || stored === 'russian' || stored === 'kazakh') {
      setLanguageState(stored);
    }
  }, []);

  const setLanguage = useCallback((next: LanguageCode) => {
    setLanguageState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
