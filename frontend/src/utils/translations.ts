export type LanguageCode = 'english' | 'russian' | 'kazakh';

type TranslationSet = {
  startGame: string;
  chooseGrade: string;
  playSolo: string;
  multiplayer: string;
  back: string;
  subject: string;
  math: string;
  logic: string;
  chooseSubject: string;
  selectMode: string;
  chooseLanguage: string;
  mathematics: string;
  logicIQ: string;
  grade: string;
  language: string;
  physics: string;
  chemistry: string;
  biology: string;
  geography: string;
  history: string;
  informatics: string;
};

export const translations: Record<LanguageCode, TranslationSet> = {
  english: {
    startGame: 'Start Game',
    chooseGrade: 'Choose Grade',
    playSolo: 'Play Solo',
    multiplayer: 'Multiplayer',
    back: 'Back',
    subject: 'Subject',
    math: 'Mathematics',
    logic: 'Logic & IQ',
    chooseSubject: 'What do you want to practice?',
    selectMode: 'Choose a game mode',
    chooseLanguage: 'Choose a language',
    mathematics: 'Mathematics',
    logicIQ: 'Logic & IQ',
    grade: 'Grade',
    language: 'Language',
    physics: 'Physics',
    chemistry: 'Chemistry',
    biology: 'Biology',
    geography: 'Geography',
    history: 'History',
    informatics: 'Informatics',
  },
  russian: {
    startGame: 'Начать игру',
    chooseGrade: 'Выбрать класс',
    playSolo: 'Соло',
    multiplayer: 'Мультиплеер',
    back: 'Назад',
    subject: 'Предмет',
    math: 'Математика',
    logic: 'Логика и IQ',
    chooseSubject: 'Что вы хотите практиковать?',
    selectMode: 'Выберите режим игры',
    chooseLanguage: 'Выберите язык',
    mathematics: 'Математика',
    logicIQ: 'Логика и IQ',
    grade: 'Класс',
    language: 'Язык',
    physics: 'Физика',
    chemistry: 'Химия',
    biology: 'Биология',
    geography: 'География',
    history: 'История',
    informatics: 'Информатика',
  },
  kazakh: {
    startGame: 'Ойынды бастау',
    chooseGrade: 'Сыныпты таңдау',
    playSolo: 'Жалғыз',
    multiplayer: 'Мультиплеер',
    back: 'Артқа',
    subject: 'Пән',
    math: 'Математика',
    logic: 'Логика және IQ',
    chooseSubject: 'Сіз нені қалайсыз?',
    selectMode: 'Ойын режимін таңдаңыз',
    chooseLanguage: 'Тілді таңдаңыз',
    mathematics: 'Математика',
    logicIQ: 'Логика және IQ',
    grade: 'Сынып',
    language: 'Тіл',
    physics: 'Физика',
    chemistry: 'Химия',
    biology: 'Биология',
    geography: 'География',
    history: 'Тарих',
    informatics: 'Информатика',
  },
};
