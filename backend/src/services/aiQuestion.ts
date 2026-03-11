import { randomUUID } from 'crypto';
import Groq from 'groq-sdk';

type Grade = 1 | 2 | 3 | 4 | 5 | 6;
type Subtype = 'single-step' | 'two-step' | 'equation';
type Operator = '+' | '-' | '*' | '/';

type ExpressionNode =
  | { type: 'value'; key: string }
  | { type: 'op'; operator: Operator; left: ExpressionNode; right: ExpressionNode };

interface TemplateDefinition {
  id: string;
  template: string;
  variables: string[];
  tree: ExpressionNode;
}

interface RNG {
  next: () => number;
  seeded: boolean;
}

interface SeededState {
  rng: RNG;
  counter: number;
}

interface GradeConfig {
  grade: Grade;
  operators: Operator[];
  min: number;
  max: number;
  allowDecimals: boolean;
  decimalPlaces: number;
  allowNegative: boolean;
  integerDivision: boolean;
  allowEquations: boolean;
  twoStepOnly: boolean;
}

export interface GeneratedQuestion {
  id: string;
  question: string;
  answer: number;
  grade: number;
  subtype: string;
}

const SESSION_QUESTIONS = new Map<string, Set<string>>();
const SEEDED_RNGS = new Map<number, SeededState>();

const MAX_UNIQUE_ATTEMPTS = 40;
const EXPAND_RANGE_AFTER = 20;
const RANGE_EXPAND_BY = 10;
const MAX_SESSION_SIZE = 200;
const MAX_BUILD_ATTEMPTS = 20;

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_SYSTEM_PROMPT_MATH =
  'You are an expert at creating math questions for Kazakhstan NIS ' +
  '(Nazarbayev Intellectual Schools) and BIL school admission tests. ' +
  'Generate questions that match the exact style, difficulty, and format ' +
  'of real NIS/BIL entrance exams. Questions should test logical thinking, ' +
  'not just memorization. ' +
  'CRITICAL: You MUST respond with ONLY a valid JSON array. ' +
  'No explanations, no markdown, no backticks, no extra text. ' +
  'Start your response with [ and end with ]';

const GROQ_SYSTEM_PROMPT_LOGIC =
  'You are an expert at creating Logic and IQ questions for Kazakhstan ' +
  'NIS (Nazarbayev Intellectual Schools) and BIL school admission tests. ' +
  'Generate questions that test: pattern recognition (number sequences, shape patterns), ' +
  'logical reasoning (if-then, true/false deductions), analogy questions (A is to B as C is to ?), ' +
  'odd one out, matrix reasoning, and word logic puzzles. ' +
  'These should match the exact style of real NIS/BIL entrance exam logic sections. ' +
  'CRITICAL: You MUST respond with ONLY a valid JSON array. ' +
  'No explanations, no markdown, no backticks, no extra text. ' +
  'Start your response with [ and end with ]';

const GROQ_SYSTEM_PROMPT_ENGLISH =
  'You are an expert at creating English language and literacy questions for Kazakhstan ' +
  'NIS (Nazarbayev Intellectual Schools) and BIL school admission tests. ' +
  'Generate diverse English questions that test: reading comprehension (passages with questions), ' +
  'grammar (tense, articles, prepositions, subject-verb agreement), vocabulary (synonyms, antonyms, definitions), ' +
  'spelling, sentence construction, and writing skills. ' +
  'Questions should match the exact style, difficulty, and format of real NIS/BIL entrance exams. ' +
  'CRITICAL: You MUST respond with ONLY a valid JSON array. ' +
  'No explanations, no markdown, no backticks, no extra text. ' +
  'Start your response with [ and end with ]';

const GROQ_SYSTEM_PROMPT_PHYSICS =
  'You are an expert at creating Physics questions for Kazakhstan ' +
  'NIS (Nazarbayev Intellectual Schools) and BIL school admission tests. ' +
  'Generate questions covering: mechanics (motion, forces, energy), thermodynamics, electricity, ' +
  'magnetism, optics, waves, and basic modern physics. ' +
  'Questions should match the exact style, difficulty, and format of real NIS/BIL entrance exams. ' +
  'CRITICAL: You MUST respond with ONLY a valid JSON array. ' +
  'No explanations, no markdown, no backticks, no extra text. ' +
  'Start your response with [ and end with ]';

const GROQ_SYSTEM_PROMPT_CHEMISTRY =
  'You are an expert at creating Chemistry questions for Kazakhstan ' +
  'NIS (Nazarbayev Intellectual Schools) and BIL school admission tests. ' +
  'Generate questions covering: atomic structure, periodic table, chemical bonding, reactions, ' +
  'stoichiometry, acids and bases, organic chemistry basics, and chemical equations. ' +
  'Questions should match the exact style, difficulty, and format of real NIS/BIL entrance exams. ' +
  'CRITICAL: You MUST respond with ONLY a valid JSON array. ' +
  'No explanations, no markdown, no backticks, no extra text. ' +
  'Start your response with [ and end with ]';

const GROQ_SYSTEM_PROMPT_BIOLOGY =
  'You are an expert at creating Biology questions for Kazakhstan ' +
  'NIS (Nazarbayev Intellectual Schools) and BIL school admission tests. ' +
  'Generate questions covering: cell biology, genetics, evolution, ecology, human anatomy and physiology, ' +
  'plants, animals, and microbiology. ' +
  'Questions should match the exact style, difficulty, and format of real NIS/BIL entrance exams. ' +
  'CRITICAL: You MUST respond with ONLY a valid JSON array. ' +
  'No explanations, no markdown, no backticks, no extra text. ' +
  'Start your response with [ and end with ]';

const GROQ_SYSTEM_PROMPT_GEOGRAPHY =
  'You are an expert at creating Geography questions for Kazakhstan ' +
  'NIS (Nazarbayev Intellectual Schools) and BIL school admission tests. ' +
  'Generate questions covering: physical geography (climate, landforms, water bodies), ' +
  'political geography (countries, capitals, borders), economic geography, population, ' +
  'natural resources, and especially Kazakhstan geography. ' +
  'Questions should match the exact style, difficulty, and format of real NIS/BIL entrance exams. ' +
  'CRITICAL: You MUST respond with ONLY a valid JSON array. ' +
  'No explanations, no markdown, no backticks, no extra text. ' +
  'Start your response with [ and end with ]';

const GROQ_SYSTEM_PROMPT_HISTORY =
  'You are an expert at creating History questions for Kazakhstan ' +
  'NIS (Nazarbayev Intellectual Schools) and BIL school admission tests. ' +
  'Generate questions covering: world history (major civilizations, events, figures), ' +
  'Kazakhstan history (from ancient times to modern day), important dates, cultural developments, ' +
  'and historical analysis. ' +
  'Questions should match the exact style, difficulty, and format of real NIS/BIL entrance exams. ' +
  'CRITICAL: You MUST respond with ONLY a valid JSON array. ' +
  'No explanations, no markdown, no backticks, no extra text. ' +
  'Start your response with [ and end with ]';

const GROQ_SYSTEM_PROMPT_INFORMATICS =
  'You are an expert at creating Informatics/Computer Science questions for Kazakhstan ' +
  'NIS (Nazarbayev Intellectual Schools) and BIL school admission tests. ' +
  'Generate questions covering: algorithms, programming logic, data structures, binary systems, ' +
  'computational thinking, basic coding concepts, and problem-solving. ' +
  'Questions should match the exact style, difficulty, and format of real NIS/BIL entrance exams. ' +
  'CRITICAL: You MUST respond with ONLY a valid JSON array. ' +
  'No explanations, no markdown, no backticks, no extra text. ' +
  'Start your response with [ and end with ]';

const GROQ_SYSTEM_PROMPT_BIL_MATH_LOGIC =
  'You are an expert at creating Mathematics and Logic questions specifically for the BIL ' +
  '(Bilim-Innovation Lyceum / Білім-Инновация Лицейі) entrance exam in Kazakhstan. ' +
  'The BIL exam contains 55 math and logic questions. Generate questions covering: ' +
  'arithmetic (addition, subtraction, multiplication, division, fractions, percentages), ' +
  'algebra (equations, inequalities, expressions), geometry (area, perimeter, angles, shapes), ' +
  'number theory (prime numbers, divisibility, LCM, GCF), word problems, ' +
  'logical sequences and patterns, spatial reasoning, and quantitative comparisons. ' +
  'Questions must be appropriate for grades 4-6 students applying to BIL lyceums. ' +
  'CRITICAL: You MUST respond with ONLY a valid JSON array. ' +
  'No explanations, no markdown, no backticks, no extra text. ' +
  'Start your response with [ and end with ]';

const GROQ_SYSTEM_PROMPT_KAZAKH =
  'You are an expert at creating Kazakh language questions specifically for the BIL ' +
  '(Bilim-Innovation Lyceum / Білім-Инновация Лицейі) entrance exam in Kazakhstan. ' +
  'The BIL exam contains 10 Kazakh language questions. Generate questions covering: ' +
  'Kazakh grammar and morphology (noun cases, verb conjugation, word formation), ' +
  'vocabulary (synonyms, antonyms, word meanings in context), ' +
  'reading comprehension (short passages with questions), ' +
  'spelling and orthography, sentence structure and punctuation. ' +
  'Questions must be in Kazakh language and appropriate for grades 4-6 students. ' +
  'CRITICAL: You MUST respond with ONLY a valid JSON array. ' +
  'No explanations, no markdown, no backticks, no extra text. ' +
  'Start your response with [ and end with ]';

const GROQ_SYSTEM_PROMPT_HISTORY_KZ =
  'You are an expert at creating History of Kazakhstan questions specifically for the BIL ' +
  '(Bilim-Innovation Lyceum / Білім-Инновация Лицейі) entrance exam in Kazakhstan. ' +
  'The BIL exam contains 10 history questions. Generate questions covering: ' +
  'ancient Kazakhstan (Saka, Scythian, Hunnic tribes and civilizations), ' +
  'medieval Kazakhstan (Kazakh Khanate founding in 1465, khans and batirs), ' +
  'Russian colonial period and national liberation movements, ' +
  'Soviet Kazakhstan (collectivization, WWII, Kazakh SSR), ' +
  'independent Kazakhstan (1991 independence, presidents, capital cities, national symbols). ' +
  'Questions must be appropriate for grades 4-6 students applying to BIL lyceums. ' +
  'CRITICAL: You MUST respond with ONLY a valid JSON array. ' +
  'No explanations, no markdown, no backticks, no extra text. ' +
  'Start your response with [ and end with ]';

const GROQ_SYSTEM_PROMPT_IELTS_READING =
  'You are an expert IELTS Reading examiner. Write an authentic IELTS Academic Reading passage ' +
  '(200-350 words) on an academic topic (science, environment, history, technology, or society), ' +
  'then write multiple-choice questions about it. ' +
  'Question types: main idea, specific information, vocabulary in context, writer opinion/attitude, inference. ' +
  'All distractors must be plausible; only one answer is correct based solely on the passage. ' +
  'CRITICAL: Respond with ONLY a valid JSON object — no markdown, no backticks, no extra text. ' +
  'Use this EXACT format: {"passage":"...full passage text...","questions":[{"question":"...","options":["...","...","...","..."],"correctAnswer":"...exact text of correct option...","explanation":"...","topic":"reading comprehension","grade":"IELTS","difficulty":"medium"}]} ' +
  'Start your response with { and end with }';

const GROQ_SYSTEM_PROMPT_IELTS_WRITING =
  'You are an expert IELTS Writing examiner. Generate multiple-choice questions that test ' +
  'writing skills as assessed in IELTS Writing Tasks 1 and 2. ' +
  'Topics include: essay structure, coherence and cohesion, task achievement, ' +
  'formal/informal register, linking words, paragraph organisation, and grammar for writing. ' +
  'Questions should test understanding of effective writing techniques and common errors. ' +
  'All options must be plausible but only one clearly correct. Use formal academic English. ' +
  'CRITICAL: You MUST respond with ONLY a valid JSON array. ' +
  'No explanations, no markdown, no backticks, no extra text. ' +
  'Start your response with [ and end with ]';

const GROQ_SYSTEM_PROMPT_IELTS_VOCAB =
  'You are an expert IELTS vocabulary specialist. Generate multiple-choice questions testing ' +
  'vocabulary as assessed in the IELTS exam. ' +
  'Topics include: Academic Word List words used in context, word meaning from context, ' +
  'synonyms and paraphrasing, collocations, phrasal verbs, word formation (prefixes/suffixes), ' +
  'and connotation. Questions should be in sentence or passage context. ' +
  'All options must be plausible but only one clearly correct. Use formal academic English. ' +
  'CRITICAL: You MUST respond with ONLY a valid JSON array. ' +
  'No explanations, no markdown, no backticks, no extra text. ' +
  'Start your response with [ and end with ]';

const GROQ_SYSTEM_PROMPT_UNT_READING =
  'You are an expert creator of UNT (Unified National Testing, Kazakhstan) Reading Literacy questions. ' +
  'Generate realistic UNT-style multiple-choice questions focused on reading comprehension, ' +
  'main idea, inference, author intent, and vocabulary in context. ' +
  'Difficulty should match real UNT entry test level for high school graduates. ' +
  'CRITICAL: You MUST respond with ONLY a valid JSON array. ' +
  'No explanations, no markdown, no backticks, no extra text. ' +
  'Start your response with [ and end with ]';

const GROQ_SYSTEM_PROMPT_UNT_MATH_LITERACY =
  'You are an expert creator of UNT (Unified National Testing, Kazakhstan) Math Literacy questions. ' +
  'Generate realistic UNT-style multiple-choice questions on everyday mathematics, percentages, ratios, ' +
  'tables/charts interpretation, basic probability, and practical problem solving. ' +
  'Difficulty should match real UNT entry test level. ' +
  'CRITICAL: You MUST respond with ONLY a valid JSON array. ' +
  'No explanations, no markdown, no backticks, no extra text. ' +
  'Start your response with [ and end with ]';

const GROQ_SYSTEM_PROMPT_UNT_HISTORY_KZ =
  'You are an expert creator of UNT (Unified National Testing, Kazakhstan) History of Kazakhstan questions. ' +
  'Generate realistic UNT-style multiple-choice questions covering ancient, medieval, imperial, Soviet, ' +
  'and independent Kazakhstan history, including key dates, figures, and events. ' +
  'Difficulty should match real UNT entry test level. ' +
  'CRITICAL: You MUST respond with ONLY a valid JSON array. ' +
  'No explanations, no markdown, no backticks, no extra text. ' +
  'Start your response with [ and end with ]';

const GROQ_SYSTEM_PROMPT_UNT_PROFILE_MATH =
  'You are an expert creator of UNT (Unified National Testing, Kazakhstan) Profile Mathematics questions. ' +
  'Generate realistic UNT-style multiple-choice questions for profile math: algebra, functions, ' +
  'trigonometry, geometry, and probability/combinatorics. ' +
  'Difficulty should match profile subject expectations in UNT. ' +
  'CRITICAL: You MUST respond with ONLY a valid JSON array. ' +
  'No explanations, no markdown, no backticks, no extra text. ' +
  'Start your response with [ and end with ]';

const GROQ_SYSTEM_PROMPT_UNT_PROFILE_PHYSICS =
  'You are an expert creator of UNT (Unified National Testing, Kazakhstan) Profile Physics questions. ' +
  'Generate realistic UNT-style multiple-choice questions for mechanics, electricity, optics, ' +
  'thermodynamics, and modern physics. ' +
  'Difficulty should match profile subject expectations in UNT. ' +
  'CRITICAL: You MUST respond with ONLY a valid JSON array. ' +
  'No explanations, no markdown, no backticks, no extra text. ' +
  'Start your response with [ and end with ]';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

export type NisBilDifficulty = 'easy' | 'medium' | 'hard';
export type QuestionLanguage = 'english' | 'russian' | 'kazakh';
export type QuestionSubject = 'math' | 'logic' | 'english' | 'physics' | 'chemistry' | 'biology' | 'geography' | 'history' | 'informatics' | 'bil_math_logic' | 'kazakh' | 'history_kz' | 'ielts_reading' | 'ielts_writing' | 'ielts_vocab' | 'unt_reading' | 'unt_math_literacy' | 'unt_history_kz' | 'unt_profile_math' | 'unt_profile_physics';

export interface NisBilQuestion {
  question: string;
  options: [string, string, string, string];
  correctAnswer: string;
  topic: string;
  grade: string;
  difficulty: NisBilDifficulty;
  explanation: string;
  passage?: string;
}

const TWO_STEP_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'two_add_mul',
    template: '(a + b) * c',
    variables: ['a', 'b', 'c'],
    tree: {
      type: 'op',
      operator: '*',
      left: {
        type: 'op',
        operator: '+',
        left: { type: 'value', key: 'a' },
        right: { type: 'value', key: 'b' },
      },
      right: { type: 'value', key: 'c' },
    },
  },
  {
    id: 'two_mul_sub',
    template: 'a * (b - c)',
    variables: ['a', 'b', 'c'],
    tree: {
      type: 'op',
      operator: '*',
      left: { type: 'value', key: 'a' },
      right: {
        type: 'op',
        operator: '-',
        left: { type: 'value', key: 'b' },
        right: { type: 'value', key: 'c' },
      },
    },
  },
  {
    id: 'two_mul_div',
    template: '(a * b) / c',
    variables: ['a', 'b', 'c'],
    tree: {
      type: 'op',
      operator: '/',
      left: {
        type: 'op',
        operator: '*',
        left: { type: 'value', key: 'a' },
        right: { type: 'value', key: 'b' },
      },
      right: { type: 'value', key: 'c' },
    },
  },
  {
    id: 'two_add_sub',
    template: '(a + b) - c',
    variables: ['a', 'b', 'c'],
    tree: {
      type: 'op',
      operator: '-',
      left: {
        type: 'op',
        operator: '+',
        left: { type: 'value', key: 'a' },
        right: { type: 'value', key: 'b' },
      },
      right: { type: 'value', key: 'c' },
    },
  },
];

const EQUATION_TEMPLATES: Array<{ id: string; operator: Operator }> = [
  { id: 'x_plus_a', operator: '+' },
  { id: 'x_minus_a', operator: '-' },
  { id: 'x_times_a', operator: '*' },
  { id: 'x_div_a', operator: '/' },
];

const GRADE_CONFIGS: Record<Grade, GradeConfig> = {
  1: {
    grade: 1,
    operators: ['+', '-'],
    min: 1,
    max: 20,
    allowDecimals: false,
    decimalPlaces: 0,
    allowNegative: false,
    integerDivision: true,
    allowEquations: false,
    twoStepOnly: false,
  },
  2: {
    grade: 2,
    operators: ['+', '-', '*'],
    min: 1,
    max: 100,
    allowDecimals: false,
    decimalPlaces: 0,
    allowNegative: false,
    integerDivision: true,
    allowEquations: false,
    twoStepOnly: false,
  },
  3: {
    grade: 3,
    operators: ['+', '-', '*', '/'],
    min: 1,
    max: 1000,
    allowDecimals: false,
    decimalPlaces: 0,
    allowNegative: false,
    integerDivision: true,
    allowEquations: false,
    twoStepOnly: false,
  },
  4: {
    grade: 4,
    operators: ['+', '-', '*', '/'],
    min: 10,
    max: 9999,
    allowDecimals: false,
    decimalPlaces: 0,
    allowNegative: false,
    integerDivision: true,
    allowEquations: false,
    twoStepOnly: true,
  },
  5: {
    grade: 5,
    operators: ['+', '-', '*', '/'],
    min: 1,
    max: 10000,
    allowDecimals: true,
    decimalPlaces: 1,
    allowNegative: true,
    integerDivision: false,
    allowEquations: false,
    twoStepOnly: false,
  },
  6: {
    grade: 6,
    operators: ['+', '-', '*', '/'],
    min: 1,
    max: 10000,
    allowDecimals: true,
    decimalPlaces: 1,
    allowNegative: true,
    integerDivision: false,
    allowEquations: true,
    twoStepOnly: false,
  },
};

function createSeededRng(seed: number): RNG {
  let state = seed >>> 0;
  return {
    seeded: true,
    next: () => {
      state += 0x6d2b79f5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

function getRng(seed?: number): RNG {
  if (seed === undefined) {
    return { seeded: false, next: Math.random };
  }

  const existing = SEEDED_RNGS.get(seed);
  if (existing) {
    return existing.rng;
  }

  const rng = createSeededRng(seed);
  SEEDED_RNGS.set(seed, { rng, counter: 0 });
  return rng;
}

function randomInt(min: number, max: number, rng: RNG): number {
  return Math.floor(rng.next() * (max - min + 1)) + min;
}

function clampGrade(grade: number): Grade {
  if (grade <= 1) return 1;
  if (grade === 2) return 2;
  if (grade === 3) return 3;
  if (grade === 4) return 4;
  if (grade === 5) return 5;
  return 6;
}

function pickOperator(config: GradeConfig, rng: RNG): Operator {
  return config.operators[randomInt(0, config.operators.length - 1, rng)];
}

function getScale(config: GradeConfig): number {
  return config.allowDecimals ? Math.pow(10, config.decimalPlaces) : 1;
}

function adjustMaxForDifficulty(config: GradeConfig, difficulty?: number): number {
  if (!difficulty) return config.max;
  const normalized = Math.min(Math.max(difficulty, 1), 10) / 10;
  const scaledMax = Math.round(config.min + (config.max - config.min) * normalized);
  return Math.max(config.min, scaledMax);
}

function createId(rng: RNG): string {
  if (!rng.seeded && typeof randomUUID === 'function') {
    return randomUUID();
  }

  if (rng.seeded) {
    const seededState = Array.from(SEEDED_RNGS.values()).find((item) => item.rng === rng);
    if (seededState) {
      seededState.counter += 1;
      const partA = Math.floor(rng.next() * 1e9);
      return `q-${partA}-${seededState.counter}`;
    }
  }

  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatValue(value: number, config: GradeConfig): string {
  if (config.allowDecimals) {
    return (value / getScale(config)).toFixed(config.decimalPlaces);
  }
  return String(value);
}

function formatAnswer(value: number, config: GradeConfig): number {
  if (config.allowDecimals) {
    const scale = getScale(config);
    return Math.round(value) / scale;
  }
  return value;
}

function generateValue(config: GradeConfig, rng: RNG, maxOverride?: number, nonZero = false): number {
  const scale = getScale(config);
  const maxValue = maxOverride ?? config.max;
  const minValue = config.min;
  const minScaled = Math.round(minValue * scale);
  const maxScaled = Math.round(maxValue * scale);

  let value = randomInt(minScaled, maxScaled, rng);
  if (config.allowNegative && rng.next() < 0.5) {
    value = -value;
  }

  if (nonZero && value === 0) {
    value = scale;
  }

  return value;
}

function evaluateExpression(node: ExpressionNode, operands: Record<string, number>, config: GradeConfig): number {
  if (node.type === 'value') {
    return operands[node.key];
  }

  const scale = getScale(config);
  const left = evaluateExpression(node.left, operands, config);
  const right = evaluateExpression(node.right, operands, config);

  switch (node.operator) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case '*':
      return config.allowDecimals ? Math.round((left * right) / scale) : left * right;
    case '/':
      if (right === 0) {
        throw new Error('Division by zero');
      }
      if (config.integerDivision) {
        const numerator = config.allowDecimals ? left * scale : left;
        if (numerator % right !== 0) {
          throw new Error('Non-integer division');
        }
        return numerator / right;
      }
      if (config.allowDecimals) {
        return Math.round((left * scale) / right);
      }
      return left / right;
    default:
      return left + right;
  }
}

function buildExpression(template: TemplateDefinition, operands: Record<string, number>, config: GradeConfig): string {
  return template.template.replace(/\b[a-z]\b/g, (match) => formatValue(operands[match], config));
}

function getDivisorsInRange(value: number, min: number, max: number): number[] {
  const divisors: number[] = [];

  for (let i = min; i <= max; i += 1) {
    if (value % i === 0) {
      divisors.push(i);
    }
  }

  return divisors;
}

function buildOperandsForSingleStep(
  config: GradeConfig,
  operator: Operator,
  rng: RNG,
  maxOverride?: number
): Record<string, number> {
  if (operator === '/') {
    if (config.integerDivision) {
      const divisor = generateValue(config, rng, maxOverride, true);
      const quotient = generateValue(config, rng, maxOverride, false);
      return {
        a: divisor * quotient,
        b: divisor,
      };
    }

    return {
      a: generateValue(config, rng, maxOverride),
      b: generateValue(config, rng, maxOverride, true),
    };
  }

  const a = generateValue(config, rng, maxOverride);
  const b = generateValue(config, rng, maxOverride);

  if (!config.allowNegative && operator === '-' && a < b) {
    return { a: b, b: a };
  }

  return { a, b };
}

function buildOperandsForTwoStep(config: GradeConfig, rng: RNG, maxOverride?: number): Record<string, number> {
  const scale = getScale(config);
  const min = Math.round(config.min * scale);
  const max = Math.round((maxOverride ?? config.max) * scale);

  const template = TWO_STEP_TEMPLATES[randomInt(0, TWO_STEP_TEMPLATES.length - 1, rng)];

  if (template.id === 'two_mul_div') {
    const a = generateValue(config, rng, maxOverride);
    const b = generateValue(config, rng, maxOverride);
    const product = a * b;
    const divisors = getDivisorsInRange(Math.abs(product), min, max);

    if (divisors.length === 0) {
      return buildOperandsForTwoStep(config, rng, maxOverride);
    }

    const c = divisors[randomInt(0, divisors.length - 1, rng)];
    return { a, b, c: product < 0 ? -c : c };
  }

  const a = generateValue(config, rng, maxOverride);
  const b = generateValue(config, rng, maxOverride);
  const c = generateValue(config, rng, maxOverride);

  if (!config.allowNegative && template.id === 'two_mul_sub' && b < c) {
    return { a, b: c, c: b };
  }

  return { a, b, c };
}

function pickTwoStepTemplate(rng: RNG): TemplateDefinition {
  return TWO_STEP_TEMPLATES[randomInt(0, TWO_STEP_TEMPLATES.length - 1, rng)];
}

function buildEquation(config: GradeConfig, rng: RNG, maxOverride?: number): { question: string; answer: number } {
  const template = EQUATION_TEMPLATES[randomInt(0, EQUATION_TEMPLATES.length - 1, rng)];
  const x = generateValue(config, rng, maxOverride, false);
  const a = generateValue(config, rng, maxOverride, template.operator === '/');
  const scale = getScale(config);

  let b = 0;
  switch (template.operator) {
    case '+':
      b = x + a;
      break;
    case '-':
      b = x - a;
      break;
    case '*':
      b = config.allowDecimals ? Math.round((x * a) / scale) : x * a;
      break;
    case '/':
      b = config.allowDecimals ? Math.round((x * scale) / a) : x / a;
      break;
    default:
      b = x + a;
      break;
  }

  const maxValue = maxOverride ?? config.max;
  if (Math.abs(b) > maxValue * scale) {
    return buildEquation(config, rng, maxOverride);
  }

  const question = `Solve: x ${template.operator} ${formatValue(a, config)} = ${formatValue(b, config)}`;
  return { question, answer: x };
}

function buildQuestion(
  config: GradeConfig,
  rng: RNG,
  rangeBoost: number,
  difficulty?: number
): GeneratedQuestion {
  const maxOverride = adjustMaxForDifficulty(config, difficulty) + rangeBoost;

  for (let attempt = 0; attempt < MAX_BUILD_ATTEMPTS; attempt += 1) {
    if (config.allowEquations && rng.next() < 0.4) {
      const equation = buildEquation(config, rng, maxOverride);
      return {
        id: createId(rng),
        question: equation.question,
        answer: formatAnswer(equation.answer, config),
        grade: config.grade,
        subtype: 'equation',
      };
    }

    const subtype: Subtype = config.twoStepOnly ? 'two-step' : 'single-step';

    if (subtype === 'two-step') {
      const template = pickTwoStepTemplate(rng);
      const operands = buildOperandsForTwoStep(config, rng, maxOverride);
      const question = buildExpression(template, operands, config);
      const answer = evaluateExpression(template.tree, operands, config);

      if (!Number.isFinite(answer)) {
        continue;
      }

      return {
        id: createId(rng),
        question,
        answer: formatAnswer(answer, config),
        grade: config.grade,
        subtype,
      };
    }

    const operator = pickOperator(config, rng);
    const operands = buildOperandsForSingleStep(config, operator, rng, maxOverride);
    const template: TemplateDefinition = {
      id: `single_${operator}`,
      template: `a ${operator} b = ?`,
      variables: ['a', 'b'],
      tree: {
        type: 'op',
        operator,
        left: { type: 'value', key: 'a' },
        right: { type: 'value', key: 'b' },
      },
    };

    const question = buildExpression(template, operands, config);
    const answer = evaluateExpression(template.tree, operands, config);

    if (!Number.isFinite(answer)) {
      continue;
    }

    if (!config.allowNegative && answer < 0) {
      continue;
    }

    return {
      id: createId(rng),
      question,
      answer: formatAnswer(answer, config),
      grade: config.grade,
      subtype,
    };
  }

  const fallback = buildQuestion(GRADE_CONFIGS[1], rng, 0, 10);
  return {
    ...fallback,
    grade: config.grade,
  };
}

function hashQuestion(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

export function generateQuestion(
  grade: number,
  options?: { seed?: number; difficulty?: number }
): GeneratedQuestion {
  const normalizedGrade = clampGrade(grade);
  const rng = getRng(options?.seed);
  const config = GRADE_CONFIGS[normalizedGrade];
  return buildQuestion(config, rng, 0, options?.difficulty);
}

export function generateUniqueQuestion(
  sessionId: string,
  grade: number,
  options?: { difficulty?: number }
): GeneratedQuestion {
  const normalizedGrade = clampGrade(grade);
  const sessionKey = sessionId || 'default';

  if (!SESSION_QUESTIONS.has(sessionKey)) {
    SESSION_QUESTIONS.set(sessionKey, new Set());
  }

  const used = SESSION_QUESTIONS.get(sessionKey) as Set<string>;
  const rng = getRng();
  const config = GRADE_CONFIGS[normalizedGrade];

  for (let attempt = 0; attempt < MAX_UNIQUE_ATTEMPTS; attempt += 1) {
    const rangeBoost = attempt >= EXPAND_RANGE_AFTER ? RANGE_EXPAND_BY : 0;
    const question = buildQuestion(config, rng, rangeBoost, options?.difficulty);
    const hash = hashQuestion(`${question.grade}|${question.subtype}|${question.question}`);

    if (!used.has(hash)) {
      used.add(hash);

      if (used.size > MAX_SESSION_SIZE) {
        used.clear();
        used.add(hash);
      }

      return question;
    }
  }

  used.clear();
  return buildQuestion(config, rng, RANGE_EXPAND_BY, options?.difficulty);
}

function ensureGroqConfigured() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured');
  }
}

function getLanguageInstruction(language: QuestionLanguage): string {
  if (language === 'russian') {
    return 'Генерируй все вопросы и ответы на русском языке.';
  }
  if (language === 'kazakh') {
    return 'Барлық сұрақтар мен жауаптарды қазақ тілінде жаз.';
  }
  return 'Generate all questions and answers in English.';
}

function getLanguageLabel(language: QuestionLanguage): string {
  if (language === 'russian') return 'Russian';
  if (language === 'kazakh') return 'Kazakh';
  return 'English';
}

/**
 * Clean Groq response to extract valid JSON
 * Removes markdown backticks and text before/after JSON
 */
function cleanJsonResponse(raw: string): string {
  let cleaned = raw.trim();
  
  // Remove markdown code blocks (```json and ```)
  cleaned = cleaned.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  
  // Find the first [ and last ]
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  
  if (firstBracket === -1 || lastBracket === -1) {
    throw new Error('No JSON array found in response');
  }
  
  // Extract only the JSON portion
  cleaned = cleaned.substring(firstBracket, lastBracket + 1);
  
  return cleaned;
}

function stripCodeFences(raw: string): string {
  return raw.trim().replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get fallback questions from the database
 */
async function getFallbackQuestionsFromDatabase(
  difficulty: number,
  count: number,
  subject: QuestionSubject
): Promise<NisBilQuestion[]> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  
  try {
    // Get questions from database with matching difficulty and subject
    const questions = await prisma.question.findMany({
      where: {
        difficulty: { gte: Math.max(1, difficulty - 2), lte: Math.min(10, difficulty + 2) },
        subject: subject,
      },
      take: count,
      orderBy: { id: 'desc' },
    });
    
    // If not enough questions, get any available
    if (questions.length < count) {
      const additional = await prisma.question.findMany({
        where: { subject: subject },
        take: count - questions.length,
        orderBy: { id: 'desc' },
      });
      questions.push(...additional);
    }
    
    // Convert Prisma questions to NisBilQuestion format
    return questions.slice(0, count).map(q => ({
      question: q.text,
      options: JSON.parse(q.options),
      correctAnswer: JSON.parse(q.options)[q.correctAnswer],
      topic: 'Database Fallback',
      grade: 'General',
      difficulty: difficulty > 6 ? 'hard' : difficulty > 3 ? 'medium' : 'easy',
      explanation: q.explanation ?? '',
    }));
  } finally {
    await prisma.$disconnect();
  }
}


function buildGroqUserPrompt(params: {
  count: number;
  gradeLabel: string;
  difficulty: NisBilDifficulty;
  topic: string;
  language: QuestionLanguage;
  subject: QuestionSubject;
}) {
  const languageLabel = getLanguageLabel(params.language);
  let subjectName = 'Math';
  let subjectDescription = 'math questions';
  
  if (params.subject === 'logic') {
    subjectName = 'Logic & IQ';
    subjectDescription = 'logic and IQ questions testing pattern recognition, logical reasoning, analogies, and matrix reasoning';
  } else if (params.subject === 'english') {
    subjectName = 'English Language';
    subjectDescription = 'English language and literacy questions testing reading comprehension, grammar, vocabulary, spelling, and writing skills';
  }
  
  return (
    `Generate ${params.count} ${subjectDescription} for a student applying to NIS/BIL ` +
    `for grade ${params.gradeLabel} entry. Difficulty: ${params.difficulty}. ` +
    `Topic: ${params.topic}. ` +
    `All text in the response including question, options, and explanation must be in ${languageLabel} only. ` +
    'No mixing of languages. ' +
    'Return ONLY a JSON array in this exact format:\n' +
    '[\n' +
    '  {\n' +
    '    question: string,\n' +
    '    options: [string, string, string, string],\n' +
    '    correctAnswer: string,\n' +
    '    topic: string,\n' +
    '    grade: string,\n' +
    '    difficulty: easy | medium | hard,\n' +
    '    explanation: string\n' +
    '  }\n' +
    ']\n' +
    'Remember: respond with ONLY the JSON array, nothing else. No markdown, no backticks, no explanations.'
  );
}

/**
 * Create Groq completion with retry logic
 * Retries up to 3 times with 1 second delay between retries
 */
async function createGroqCompletionWithRetry(
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  useResponseFormat: boolean,
  retries = 3
) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const payload: any = {
        model: GROQ_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 2000,
      };

      if (useResponseFormat) {
        payload.response_format = { type: 'json_object' };
      }

      const result = await groq.chat.completions.create(payload);
      return result;
    } catch (error: any) {
      // If this was a json_object format error, retry without format
      if (useResponseFormat && attempt === 0) {
        return createGroqCompletionWithRetry(messages, false, 3);
      }
      
      // Log the error for debugging
      console.error(`Groq API attempt ${attempt + 1}/${retries} failed:`, error.message);
      
      // Wait before retrying (except on last attempt)
      if (attempt < retries - 1) {
        await sleep(1000);
      }
    }
  }

  throw new Error('Groq API failed after 3 retries');
}

async function createGroqCompletion(messages: Array<{ role: 'system' | 'user'; content: string }>, useResponseFormat: boolean) {
  const payload: any = {
    model: GROQ_MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 2000,
  };

  if (useResponseFormat) {
    payload.response_format = { type: 'json_object' };
  }

  try {
    return await groq.chat.completions.create(payload);
  } catch (error: any) {
    if (useResponseFormat) {
      return await createGroqCompletion(messages, false);
    }
    throw error;
  }
}

function parseGroqQuestions(raw: string): NisBilQuestion[] {
  const stripped = stripCodeFences(raw);

  let parsed: any;
  try {
    parsed = JSON.parse(stripped);
  } catch (error) {
    // Fallback: extract JSON array when the model includes extra text.
    try {
      parsed = JSON.parse(cleanJsonResponse(raw));
    } catch {
      throw new Error('Groq returned invalid JSON after cleaning');
    }
  }

  const questions = Array.isArray(parsed) ? parsed : parsed?.questions || parsed?.items;
  if (!Array.isArray(questions)) {
    throw new Error('Groq response did not include a question array');
  }

  const normalized: NisBilQuestion[] = [];
  for (const item of questions) {
    if (!item || typeof item.question !== 'string' || !Array.isArray(item.options)) {
      continue;
    }

    const options = item.options.filter((value: any) => typeof value === 'string').slice(0, 4);
    if (options.length !== 4 || typeof item.correctAnswer !== 'string') {
      continue;
    }

    let correctAnswer = item.correctAnswer.trim();
    if (!options.includes(correctAnswer)) {
      const letterMatch = correctAnswer.match(/^([A-D])$/i);
      const numericMatch = correctAnswer.match(/^([1-4])$/);
      if (letterMatch) {
        const idx = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
        correctAnswer = options[idx] || correctAnswer;
      } else if (numericMatch) {
        const idx = Number(numericMatch[1]) - 1;
        correctAnswer = options[idx] || correctAnswer;
      }
    }

    if (!options.includes(correctAnswer)) {
      continue;
    }

    const difficulty = item.difficulty === 'hard' || item.difficulty === 'medium' ? item.difficulty : 'easy';

    normalized.push({
      question: item.question.trim(),
      options: [options[0], options[1], options[2], options[3]],
      correctAnswer,
      topic: typeof item.topic === 'string' ? item.topic : '',
      grade: typeof item.grade === 'string' ? item.grade : '',
      difficulty,
      explanation: typeof item.explanation === 'string' ? item.explanation : '',
    });
  }

  if (normalized.length === 0) {
    throw new Error('Groq response did not contain valid questions');
  }

  return normalized;
}

function parseGroqReadingPassage(raw: string): NisBilQuestion[] {
  const stripped = stripCodeFences(raw);
  let parsed: any;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    try {
      parsed = JSON.parse(cleanJsonResponse(raw));
    } catch {
      throw new Error('Groq returned invalid JSON after cleaning');
    }
  }

  const passage = typeof parsed?.passage === 'string' ? parsed.passage.trim() : undefined;
  const rawQuestions = Array.isArray(parsed?.questions) ? parsed.questions : Array.isArray(parsed) ? parsed : null;
  if (!rawQuestions) {
    throw new Error('Groq reading response did not include a questions array');
  }

  const normalized: NisBilQuestion[] = [];
  for (const item of rawQuestions) {
    if (!item || typeof item.question !== 'string' || !Array.isArray(item.options)) {
      continue;
    }

    const options = item.options.filter((value: any) => typeof value === 'string').slice(0, 4);
    if (options.length !== 4 || typeof item.correctAnswer !== 'string') {
      continue;
    }

    let correctAnswer = item.correctAnswer.trim();
    if (!options.includes(correctAnswer)) {
      const letterMatch = correctAnswer.match(/^([A-D])$/i);
      const numericMatch = correctAnswer.match(/^([1-4])$/);
      if (letterMatch) {
        const idx = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
        correctAnswer = options[idx] || correctAnswer;
      } else if (numericMatch) {
        const idx = Number(numericMatch[1]) - 1;
        correctAnswer = options[idx] || correctAnswer;
      }
    }

    if (!options.includes(correctAnswer)) {
      continue;
    }

    const difficulty: NisBilDifficulty = item.difficulty === 'hard' || item.difficulty === 'medium'
      ? item.difficulty
      : 'medium';

    normalized.push({
      question: item.question.trim(),
      options: [options[0], options[1], options[2], options[3]],
      correctAnswer,
      topic: typeof item.topic === 'string' ? item.topic : 'reading comprehension',
      grade: typeof item.grade === 'string' ? item.grade : 'IELTS',
      difficulty,
      explanation: typeof item.explanation === 'string' ? item.explanation : '',
      passage,
    });
  }

  if (normalized.length === 0) {
    throw new Error('Groq reading response did not contain valid questions');
  }

  return normalized;
}

function getBuiltInFallbackQuestions(
  count: number,

  subject: QuestionSubject,
  difficulty: NisBilDifficulty
): NisBilQuestion[] {
  const bankBySubject: Record<QuestionSubject, NisBilQuestion[]> = {
    math: [
      { question: 'What is 15% of 200?', options: ['20', '25', '30', '35'], correctAnswer: '30', topic: 'percentages', grade: 'NIS/BIL entry level', difficulty, explanation: '15% of 200 = 0.15 x 200 = 30.' },
      { question: 'Solve: 3x + 5 = 20', options: ['3', '4', '5', '6'], correctAnswer: '5', topic: 'algebra equations', grade: 'NIS/BIL entry level', difficulty, explanation: '3x = 15, so x = 5.' },
      { question: 'A triangle has angles 50° and 60°. Find the third angle.', options: ['60°', '70°', '80°', '90°'], correctAnswer: '70°', topic: 'geometry basics', grade: 'NIS/BIL entry level', difficulty, explanation: 'Angles in a triangle sum to 180°.' },
      { question: 'What is 7/8 as a decimal?', options: ['0.75', '0.875', '0.625', '0.95'], correctAnswer: '0.875', topic: 'fractions and decimals', grade: 'NIS/BIL entry level', difficulty, explanation: '7 divided by 8 equals 0.875.' },
    ],
    logic: [
      { question: '2, 6, 12, 20, 30, ? ', options: ['36', '40', '42', '44'], correctAnswer: '42', topic: 'number sequences', grade: 'NIS/BIL entry level', difficulty, explanation: 'Differences are +4, +6, +8, +10, so next is +12.' },
      { question: 'If all roses are flowers and some flowers fade quickly, which is true?', options: ['All roses fade quickly', 'Some roses are flowers', 'No flowers are roses', 'All flowers are roses'], correctAnswer: 'Some roses are flowers', topic: 'logical deductions', grade: 'NIS/BIL entry level', difficulty, explanation: 'Given all roses are flowers, at least roses belong to flowers.' },
      { question: 'Odd one out: 3, 5, 11, 14, 17', options: ['3', '5', '11', '14'], correctAnswer: '14', topic: 'pattern recognition', grade: 'NIS/BIL entry level', difficulty, explanation: '14 is the only even number.' },
      { question: 'Book is to Read as Fork is to ?', options: ['Cook', 'Eat', 'Cut', 'Plate'], correctAnswer: 'Eat', topic: 'analogies', grade: 'NIS/BIL entry level', difficulty, explanation: 'A fork is used to eat.' },
    ],
    english: [
      { question: 'Choose the correct sentence.', options: ['She go to school.', 'She goes to school.', 'She going to school.', 'She gone to school.'], correctAnswer: 'She goes to school.', topic: 'grammar', grade: 'NIS/BIL entry level', difficulty, explanation: 'Third-person singular takes -s in present simple.' },
      { question: 'Synonym of "rapid" is:', options: ['slow', 'quick', 'weak', 'late'], correctAnswer: 'quick', topic: 'vocabulary', grade: 'NIS/BIL entry level', difficulty, explanation: 'Rapid means quick.' },
      { question: 'Fill in: They have lived here ___ 2019.', options: ['for', 'since', 'from', 'at'], correctAnswer: 'since', topic: 'tenses', grade: 'NIS/BIL entry level', difficulty, explanation: 'Use since with a starting point in time.' },
      { question: 'Antonym of "generous" is:', options: ['kind', 'selfish', 'helpful', 'friendly'], correctAnswer: 'selfish', topic: 'vocabulary', grade: 'NIS/BIL entry level', difficulty, explanation: 'Selfish is opposite in meaning to generous.' },
    ],
    physics: [
      { question: 'What is the SI unit of force?', options: ['Joule', 'Pascal', 'Newton', 'Watt'], correctAnswer: 'Newton', topic: 'motion and forces', grade: 'NIS/BIL entry level', difficulty, explanation: 'Force is measured in newtons (N).' },
      { question: 'Speed is distance divided by:', options: ['time', 'mass', 'volume', 'area'], correctAnswer: 'time', topic: 'motion and forces', grade: 'NIS/BIL entry level', difficulty, explanation: 'Speed = distance / time.' },
      { question: 'Which is a renewable energy source?', options: ['Coal', 'Oil', 'Wind', 'Natural gas'], correctAnswer: 'Wind', topic: 'energy and work', grade: 'NIS/BIL entry level', difficulty, explanation: 'Wind is renewable.' },
      { question: 'Which mirror can form a real image?', options: ['Plane mirror', 'Concave mirror', 'Convex mirror', 'None'], correctAnswer: 'Concave mirror', topic: 'optics', grade: 'NIS/BIL entry level', difficulty, explanation: 'Concave mirrors can form real images.' },
    ],
    chemistry: [
      { question: 'Chemical symbol of sodium is:', options: ['S', 'So', 'Na', 'N'], correctAnswer: 'Na', topic: 'atomic structure', grade: 'NIS/BIL entry level', difficulty, explanation: 'Sodium is represented by Na.' },
      { question: 'pH less than 7 indicates:', options: ['acid', 'base', 'neutral', 'salt'], correctAnswer: 'acid', topic: 'acids and bases', grade: 'NIS/BIL entry level', difficulty, explanation: 'Acidic solutions have pH below 7.' },
      { question: 'H2O is:', options: ['oxygen', 'hydrogen', 'water', 'carbon dioxide'], correctAnswer: 'water', topic: 'chemical formulas', grade: 'NIS/BIL entry level', difficulty, explanation: 'H2O is water.' },
      { question: 'Which particle has a negative charge?', options: ['proton', 'neutron', 'electron', 'nucleus'], correctAnswer: 'electron', topic: 'atomic structure', grade: 'NIS/BIL entry level', difficulty, explanation: 'Electrons are negatively charged.' },
    ],
    biology: [
      { question: 'Basic unit of life is:', options: ['atom', 'cell', 'organ', 'tissue'], correctAnswer: 'cell', topic: 'cell biology', grade: 'NIS/BIL entry level', difficulty, explanation: 'The cell is the basic unit of life.' },
      { question: 'Photosynthesis occurs mainly in:', options: ['roots', 'stems', 'leaves', 'flowers'], correctAnswer: 'leaves', topic: 'plants', grade: 'NIS/BIL entry level', difficulty, explanation: 'Leaves contain chloroplasts for photosynthesis.' },
      { question: 'Human blood is pumped by the:', options: ['lungs', 'brain', 'heart', 'kidneys'], correctAnswer: 'heart', topic: 'human anatomy', grade: 'NIS/BIL entry level', difficulty, explanation: 'The heart pumps blood.' },
      { question: 'DNA stands for:', options: ['Deoxyribonucleic acid', 'Dynamic nucleic acid', 'Double nitrogen acid', 'Dense ribose acid'], correctAnswer: 'Deoxyribonucleic acid', topic: 'genetics', grade: 'NIS/BIL entry level', difficulty, explanation: 'DNA means deoxyribonucleic acid.' },
    ],
    geography: [
      { question: 'The longest river in the world is commonly taught as:', options: ['Amazon', 'Nile', 'Yangtze', 'Volga'], correctAnswer: 'Nile', topic: 'physical geography', grade: 'NIS/BIL entry level', difficulty, explanation: 'Most school curricula identify Nile as the longest.' },
      { question: 'Capital of Kazakhstan is:', options: ['Almaty', 'Shymkent', 'Astana', 'Aktobe'], correctAnswer: 'Astana', topic: 'Kazakhstan geography', grade: 'NIS/BIL entry level', difficulty, explanation: 'Astana is the capital city.' },
      { question: 'A map scale is used to show:', options: ['weather only', 'distance relation', 'population growth', 'language'], correctAnswer: 'distance relation', topic: 'map skills', grade: 'NIS/BIL entry level', difficulty, explanation: 'Scale compares map distance to real distance.' },
      { question: 'Which layer contains weather phenomena?', options: ['Stratosphere', 'Troposphere', 'Mesosphere', 'Thermosphere'], correctAnswer: 'Troposphere', topic: 'climate', grade: 'NIS/BIL entry level', difficulty, explanation: 'Most weather occurs in the troposphere.' },
    ],
    history: [
      { question: 'The Silk Road connected China mainly with:', options: ['South America', 'Europe', 'Australia', 'Antarctica'], correctAnswer: 'Europe', topic: 'world history', grade: 'NIS/BIL entry level', difficulty, explanation: 'The Silk Road linked East Asia to Europe.' },
      { question: 'Who was the first president of independent Kazakhstan?', options: ['Kassym-Jomart Tokayev', 'Nursultan Nazarbayev', 'Dinmukhamed Kunaev', 'Akhmet Baitursynuly'], correctAnswer: 'Nursultan Nazarbayev', topic: 'Kazakhstan history', grade: 'NIS/BIL entry level', difficulty, explanation: 'Nazarbayev became the first president after independence.' },
      { question: 'Year of Kazakhstan independence:', options: ['1989', '1991', '1993', '1995'], correctAnswer: '1991', topic: 'Kazakhstan history', grade: 'NIS/BIL entry level', difficulty, explanation: 'Kazakhstan declared independence in 1991.' },
      { question: 'Renaissance began in:', options: ['France', 'Italy', 'Germany', 'England'], correctAnswer: 'Italy', topic: 'world history', grade: 'NIS/BIL entry level', difficulty, explanation: 'The Renaissance started in Italian city-states.' },
    ],
    informatics: [
      { question: 'Binary of decimal 5 is:', options: ['101', '110', '111', '100'], correctAnswer: '101', topic: 'binary systems', grade: 'NIS/BIL entry level', difficulty, explanation: '5 in binary is 101.' },
      { question: 'An algorithm is:', options: ['a random idea', 'step-by-step instructions', 'a hardware component', 'a network cable'], correctAnswer: 'step-by-step instructions', topic: 'algorithms', grade: 'NIS/BIL entry level', difficulty, explanation: 'Algorithms are ordered problem-solving steps.' },
      { question: 'Which is a loop structure?', options: ['if', 'while', 'print', 'input'], correctAnswer: 'while', topic: 'programming logic', grade: 'NIS/BIL entry level', difficulty, explanation: 'while is a loop construct.' },
      { question: 'CPU stands for:', options: ['Central Process Unit', 'Central Processing Unit', 'Computer Primary Unit', 'Core Process Utility'], correctAnswer: 'Central Processing Unit', topic: 'computer basics', grade: 'NIS/BIL entry level', difficulty, explanation: 'CPU means Central Processing Unit.' },
    ],
    bil_math_logic: [
      { question: 'What is the LCM of 4 and 6?', options: ['8', '10', '12', '24'], correctAnswer: '12', topic: 'number theory', grade: 'BIL entry level', difficulty, explanation: 'LCM(4,6) = 12 because 12 is the smallest number divisible by both 4 and 6.' },
      { question: 'A rectangle has length 8 cm and width 5 cm. What is its area?', options: ['26 cm²', '30 cm²', '40 cm²', '45 cm²'], correctAnswer: '40 cm²', topic: 'geometry', grade: 'BIL entry level', difficulty, explanation: 'Area = length × width = 8 × 5 = 40 cm².' },
      { question: '2, 4, 8, 16, ? What comes next?', options: ['24', '28', '30', '32'], correctAnswer: '32', topic: 'logical sequences', grade: 'BIL entry level', difficulty, explanation: 'Each number is multiplied by 2.' },
      { question: 'If a bag of apples costs 250 tenge and you buy 3 bags, how much do you pay?', options: ['650 tenge', '700 tenge', '750 tenge', '800 tenge'], correctAnswer: '750 tenge', topic: 'word problems', grade: 'BIL entry level', difficulty, explanation: '250 × 3 = 750 tenge.' },
      { question: 'What is 35% of 200?', options: ['60', '65', '70', '75'], correctAnswer: '70', topic: 'percentages', grade: 'BIL entry level', difficulty, explanation: '35% of 200 = 0.35 × 200 = 70.' },
      { question: 'Odd one out: 2, 3, 5, 7, 9', options: ['2', '3', '7', '9'], correctAnswer: '9', topic: 'number theory', grade: 'BIL entry level', difficulty, explanation: '9 = 3×3 is not a prime number, while 2, 3, 5, 7 are all prime.' },
      { question: 'A train travels 120 km in 2 hours. What is its speed?', options: ['50 km/h', '55 km/h', '60 km/h', '65 km/h'], correctAnswer: '60 km/h', topic: 'word problems', grade: 'BIL entry level', difficulty, explanation: 'Speed = distance ÷ time = 120 ÷ 2 = 60 km/h.' },
      { question: 'Solve: 5x − 3 = 22', options: ['4', '5', '6', '7'], correctAnswer: '5', topic: 'algebra', grade: 'BIL entry level', difficulty, explanation: '5x = 25, so x = 5.' },
      { question: 'A is taller than B. B is taller than C. Who is the shortest?', options: ['A', 'B', 'C', 'Cannot tell'], correctAnswer: 'C', topic: 'logical reasoning', grade: 'BIL entry level', difficulty, explanation: 'A > B > C, so C is the shortest.' },
      { question: 'What fraction of 60 is 15?', options: ['1/3', '1/4', '1/5', '1/6'], correctAnswer: '1/4', topic: 'fractions', grade: 'BIL entry level', difficulty, explanation: '15/60 = 1/4.' },
    ],
    kazakh: [
      { question: 'Қазақ тіліндегі «кітап» сөзінің көпше түрі қандай?', options: ['кітаптар', 'кітапшалар', 'кітапхана', 'кітаптама'], correctAnswer: 'кітаптар', topic: 'Kazakh grammar', grade: 'BIL entry level', difficulty, explanation: 'Зат есімге -тар/-тер, -дар/-дер, -лар/-лер жалғанады.' },
      { question: '«Мектеп» сөзінің антонимі қайсы?', options: ['сынып', 'үй', 'дала', 'ауруxана'], correctAnswer: 'үй', topic: 'vocabulary', grade: 'BIL entry level', difficulty, explanation: 'Мектеп – үй — мағынасы қарама-қарсы сөздер.' },
      { question: 'Сөйлемдегі зат есімді табыңыз: «Бала кітап оқыды.»', options: ['Бала', 'оқыды', 'кітап', 'Бала және кітап'], correctAnswer: 'Бала және кітап', topic: 'grammar', grade: 'BIL entry level', difficulty, explanation: 'Бала және кітап – зат есімдер.' },
      { question: '«Жылдам» сөзінің синонимі қайсы?', options: ['баяу', 'тез', 'үлкен', 'кіші'], correctAnswer: 'тез', topic: 'vocabulary', grade: 'BIL entry level', difficulty, explanation: 'Жылдам = тез (екеуі де жедел мағынасын береді).' },
      { question: 'Қай сөз дұрыс жазылған?', options: ['мектебте', 'мектепте', 'мектіпте', 'мектапта'], correctAnswer: 'мектепте', topic: 'spelling', grade: 'BIL entry level', difficulty, explanation: 'Мектеп + те = мектепте (жалғауды дыбыс үндестігіне сай жазу).' },
    ],
    history_kz: [
      { question: 'Kazakhstan declared independence in which year?', options: ['1989', '1990', '1991', '1992'], correctAnswer: '1991', topic: 'independent Kazakhstan', grade: 'BIL entry level', difficulty, explanation: 'Kazakhstan declared independence on December 16, 1991.' },
      { question: 'The Kazakh Khanate was founded in approximately:', options: ['1265', '1365', '1465', '1565'], correctAnswer: '1465', topic: 'Kazakh Khanate', grade: 'BIL entry level', difficulty, explanation: 'The Kazakh Khanate was established around 1465 by Kerey Khan and Janibek Khan.' },
      { question: 'What is the current capital of Kazakhstan?', options: ['Almaty', 'Shymkent', 'Astana', 'Semey'], correctAnswer: 'Astana', topic: 'independent Kazakhstan', grade: 'BIL entry level', difficulty, explanation: 'Astana is the current capital (previously named Nur-Sultan 2019–2022).' },
      { question: 'Who was the first President of independent Kazakhstan?', options: ['Kassym-Jomart Tokayev', 'Nursultan Nazarbayev', 'Dinmukhamed Kunaev', 'Zhumabek Tashenov'], correctAnswer: 'Nursultan Nazarbayev', topic: 'independent Kazakhstan', grade: 'BIL entry level', difficulty, explanation: 'Nursultan Nazarbayev served as the first president from 1991 to 2019.' },
      { question: 'The ancient Saka tribes lived on the territory of modern Kazakhstan approximately in:', options: ['VIII–III centuries BC', 'III–I centuries BC', 'I–III centuries AD', 'V–VIII centuries AD'], correctAnswer: 'VIII–III centuries BC', topic: 'ancient Kazakhstan', grade: 'BIL entry level', difficulty, explanation: 'The Saka (Scythian) tribes dominated the Kazakh steppe from the 8th to 3rd centuries BC.' },
    ],
    ielts_reading: [
      { passage: 'The urban heat island effect occurs when cities experience higher temperatures than surrounding rural areas. This phenomenon is primarily caused by the replacement of natural land cover with pavements, buildings, and other infrastructure that absorb and retain heat. Dark surfaces such as asphalt roads and rooftops absorb up to 95% of incoming solar radiation. Additionally, reduced vegetation in cities means less cooling from evapotranspiration, while the concentration of human activities — traffic, industry, and air conditioning — releases additional heat. Researchers have found that urban centres can be 1–3°C warmer than nearby rural areas during the day, and up to 12°C warmer at night. This has significant implications for public health, energy consumption, and urban planning. Strategies to mitigate the urban heat island effect include increasing green spaces, planting street trees, installing green roofs, and using cool pavements that reflect rather than absorb solar energy.', question: 'What is the PRIMARY cause of the urban heat island effect according to the passage?', options: ['Increased rainfall in cities', 'Replacement of natural land cover with heat-absorbing infrastructure', 'Higher levels of air pollution', 'Greater population density in cities'], correctAnswer: 'Replacement of natural land cover with heat-absorbing infrastructure', topic: 'main idea', grade: 'IELTS', difficulty, explanation: 'The passage states the effect is "primarily caused by the replacement of natural land cover with pavements, buildings, and other infrastructure that absorb and retain heat."' },
      { passage: 'The urban heat island effect occurs when cities experience higher temperatures than surrounding rural areas. This phenomenon is primarily caused by the replacement of natural land cover with pavements, buildings, and other infrastructure that absorb and retain heat. Dark surfaces such as asphalt roads and rooftops absorb up to 95% of incoming solar radiation. Additionally, reduced vegetation in cities means less cooling from evapotranspiration, while the concentration of human activities — traffic, industry, and air conditioning — releases additional heat. Researchers have found that urban centres can be 1–3°C warmer than nearby rural areas during the day, and up to 12°C warmer at night. This has significant implications for public health, energy consumption, and urban planning. Strategies to mitigate the urban heat island effect include increasing green spaces, planting street trees, installing green roofs, and using cool pavements that reflect rather than absorb solar energy.', question: 'According to the passage, how much warmer can urban centres be compared to rural areas at night?', options: ['1–3°C', '3–6°C', 'Up to 12°C', 'Up to 20°C'], correctAnswer: 'Up to 12°C', topic: 'specific information', grade: 'IELTS', difficulty, explanation: 'The passage states "up to 12°C warmer at night."' },
      { passage: 'The urban heat island effect occurs when cities experience higher temperatures than surrounding rural areas. This phenomenon is primarily caused by the replacement of natural land cover with pavements, buildings, and other infrastructure that absorb and retain heat. Dark surfaces such as asphalt roads and rooftops absorb up to 95% of incoming solar radiation. Additionally, reduced vegetation in cities means less cooling from evapotranspiration, while the concentration of human activities — traffic, industry, and air conditioning — releases additional heat. Researchers have found that urban centres can be 1–3°C warmer than nearby rural areas during the day, and up to 12°C warmer at night. This has significant implications for public health, energy consumption, and urban planning. Strategies to mitigate the urban heat island effect include increasing green spaces, planting street trees, installing green roofs, and using cool pavements that reflect rather than absorb solar energy.', question: 'In the passage, "mitigate" (last sentence) most closely means:', options: ['worsen', 'measure', 'reduce', 'ignore'], correctAnswer: 'reduce', topic: 'vocabulary in context', grade: 'IELTS', difficulty, explanation: '"Mitigate" means to lessen or reduce the severity of something.' },
      { passage: 'The urban heat island effect occurs when cities experience higher temperatures than surrounding rural areas. This phenomenon is primarily caused by the replacement of natural land cover with pavements, buildings, and other infrastructure that absorb and retain heat. Dark surfaces such as asphalt roads and rooftops absorb up to 95% of incoming solar radiation. Additionally, reduced vegetation in cities means less cooling from evapotranspiration, while the concentration of human activities — traffic, industry, and air conditioning — releases additional heat. Researchers have found that urban centres can be 1–3°C warmer than nearby rural areas during the day, and up to 12°C warmer at night. This has significant implications for public health, energy consumption, and urban planning. Strategies to mitigate the urban heat island effect include increasing green spaces, planting street trees, installing green roofs, and using cool pavements that reflect rather than absorb solar energy.', question: 'Which of the following strategies to reduce the urban heat island effect is mentioned in the passage?', options: ['Building taller skyscrapers', 'Reducing car ownership', 'Installing green roofs', 'Relocating factories outside cities'], correctAnswer: 'Installing green roofs', topic: 'specific information', grade: 'IELTS', difficulty, explanation: 'The passage specifically lists "installing green roofs" as one mitigation strategy.' },
      { passage: 'The urban heat island effect occurs when cities experience higher temperatures than surrounding rural areas. This phenomenon is primarily caused by the replacement of natural land cover with pavements, buildings, and other infrastructure that absorb and retain heat. Dark surfaces such as asphalt roads and rooftops absorb up to 95% of incoming solar radiation. Additionally, reduced vegetation in cities means less cooling from evapotranspiration, while the concentration of human activities — traffic, industry, and air conditioning — releases additional heat. Researchers have found that urban centres can be 1–3°C warmer than nearby rural areas during the day, and up to 12°C warmer at night. This has significant implications for public health, energy consumption, and urban planning. Strategies to mitigate the urban heat island effect include increasing green spaces, planting street trees, installing green roofs, and using cool pavements that reflect rather than absorb solar energy.', question: 'Why does reduced vegetation worsen the urban heat island effect?', options: ['Vegetation produces carbon dioxide', 'Vegetation blocks sunlight from reaching the ground', 'Less vegetation means less cooling through evapotranspiration', 'Vegetation stores more solar radiation than buildings'], correctAnswer: 'Less vegetation means less cooling through evapotranspiration', topic: 'inference', grade: 'IELTS', difficulty, explanation: 'The passage states "reduced vegetation in cities means less cooling from evapotranspiration."' },
    ],
    ielts_writing: [
      { question: 'Which sentence is most appropriate for a formal IELTS Task 2 essay introduction?', options: ['I totally agree with this idea.', 'This essay will discuss some points about the topic.', 'This essay examines the extent to which the benefits of globalisation outweigh the drawbacks.', 'Globalisation is a big topic these days.'], correctAnswer: 'This essay examines the extent to which the benefits of globalisation outweigh the drawbacks.', topic: 'essay introduction', grade: 'IELTS', difficulty, explanation: 'A strong formal introduction paraphrases the question and outlines the essay\'s scope in academic language.' },
      { question: 'Which linking phrase BEST introduces a contrasting idea?', options: ['Furthermore', 'In addition', 'Nevertheless', 'Consequently'], correctAnswer: 'Nevertheless', topic: 'linking words', grade: 'IELTS', difficulty, explanation: '"Nevertheless" introduces a contrast or concession, unlike "Furthermore" and "In addition" (which add) or "Consequently" (which shows result).' },
      { question: 'In IELTS Writing Task 2, "coherence" refers to:', options: ['using a wide vocabulary range', 'the logical flow and organisation of ideas', 'correct grammar and punctuation', 'the number of words written'], correctAnswer: 'the logical flow and organisation of ideas', topic: 'coherence and cohesion', grade: 'IELTS', difficulty, explanation: 'Coherence is about how logically ideas are arranged and connected, making text easy to follow.' },
      { question: 'Which sentence uses the CORRECT formal register for Task 2?', options: ['Lots of young people can\'t find jobs.', 'Youth unemployment is a growing concern in many economies.', 'It\'s really hard for young people to get work nowadays.', 'Young people these days just don\'t want to work hard.'], correctAnswer: 'Youth unemployment is a growing concern in many economies.', topic: 'formal register', grade: 'IELTS', difficulty, explanation: 'IELTS essays require formal, academic language — no contractions, slang, or overly casual phrasing.' },
      { question: 'A well-structured body paragraph in an IELTS essay should begin with:', options: ['A concluding sentence', 'A topic sentence stating the main idea', 'A list of examples', 'A question to the reader'], correctAnswer: 'A topic sentence stating the main idea', topic: 'paragraph structure', grade: 'IELTS', difficulty, explanation: 'Every body paragraph should open with a clear topic sentence that signals its main argument.' },
    ],
    ielts_vocab: [
      { question: 'Choose the best synonym for "mitigate" as used in academic writing:', options: ['worsen', 'ignore', 'reduce / lessen', 'cause'], correctAnswer: 'reduce / lessen', topic: 'academic word list', grade: 'IELTS', difficulty, explanation: '"Mitigate" means to make something less severe or serious.' },
      { question: 'Which word correctly completes the collocation: "___ a conclusion"?', options: ['make', 'do', 'reach', 'get'], correctAnswer: 'reach', topic: 'collocations', grade: 'IELTS', difficulty, explanation: 'The correct collocation is "reach a conclusion", not make, do, or get.' },
      { question: 'The prefix "un-" in "unprecedented" means:', options: ['again', 'before', 'not / without', 'after'], correctAnswer: 'not / without', topic: 'word formation', grade: 'IELTS', difficulty, explanation: '"Un-" is a common English prefix meaning not — "unprecedented" = never having happened before.' },
      { question: 'In "The policy had a detrimental effect on the economy", "detrimental" means:', options: ['beneficial', 'neutral', 'harmful', 'temporary'], correctAnswer: 'harmful', topic: 'vocabulary in context', grade: 'IELTS', difficulty, explanation: '"Detrimental" means causing harm or damage.' },
      { question: 'Which word is a synonym of "substantial" in an academic context?', options: ['tiny', 'considerable', 'rapid', 'vague'], correctAnswer: 'considerable', topic: 'synonyms', grade: 'IELTS', difficulty, explanation: '"Substantial" means large in size or importance, which is closest to "considerable".' },
    ],
    unt_reading: [
      { question: 'The main purpose of an argumentative text is to:', options: ['entertain with fictional events', 'present and support a point of view', 'list unrelated facts', 'describe only physical objects'], correctAnswer: 'present and support a point of view', topic: 'main idea', grade: 'UNT', difficulty, explanation: 'Argumentative texts aim to convince using claims and evidence.' },
      { question: 'If the author writes "however" between two ideas, this most likely signals:', options: ['a conclusion', 'a contrast', 'a definition', 'a timeline'], correctAnswer: 'a contrast', topic: 'text structure', grade: 'UNT', difficulty, explanation: '"However" introduces contrast between statements.' },
      { question: 'In reading comprehension, an inference is:', options: ['a direct quote from the text', 'a guess without evidence', 'a conclusion based on clues in the text', 'a synonym list'], correctAnswer: 'a conclusion based on clues in the text', topic: 'inference', grade: 'UNT', difficulty, explanation: 'Inference combines textual clues with reasoning.' },
      { question: 'The phrase "economic downturn" most nearly means:', options: ['rapid growth', 'financial decline', 'new market launch', 'tax reduction'], correctAnswer: 'financial decline', topic: 'vocabulary in context', grade: 'UNT', difficulty, explanation: 'Downturn indicates a decline in economic activity.' },
      { question: 'Which statement best identifies author bias?', options: ['The text contains dates and statistics only', 'The author uses emotionally loaded words favoring one side', 'The paragraph has short sentences', 'The article includes a title'], correctAnswer: 'The author uses emotionally loaded words favoring one side', topic: 'author perspective', grade: 'UNT', difficulty, explanation: 'Loaded language can reveal bias and stance.' },
    ],
    unt_math_literacy: [
      { question: 'A jacket costs 20,000 tenge and has a 15% discount. What is the final price?', options: ['16,000', '17,000', '18,000', '19,000'], correctAnswer: '17,000', topic: 'percentages', grade: 'UNT', difficulty, explanation: '15% of 20,000 is 3,000; 20,000 − 3,000 = 17,000.' },
      { question: 'If 3 notebooks cost 1,200 tenge, how much do 5 notebooks cost at the same rate?', options: ['1,500', '1,800', '2,000', '2,200'], correctAnswer: '2,000', topic: 'ratios', grade: 'UNT', difficulty, explanation: 'One notebook is 400 tenge, so 5 cost 2,000.' },
      { question: 'A bus travels 180 km in 3 hours. Its average speed is:', options: ['50 km/h', '55 km/h', '60 km/h', '65 km/h'], correctAnswer: '60 km/h', topic: 'practical math', grade: 'UNT', difficulty, explanation: 'Speed = distance / time = 180 / 3 = 60.' },
      { question: 'What is the probability of getting an even number on one fair six-sided die?', options: ['1/6', '1/3', '1/2', '2/3'], correctAnswer: '1/2', topic: 'basic probability', grade: 'UNT', difficulty, explanation: 'Even outcomes are 2, 4, 6: 3 out of 6 = 1/2.' },
      { question: 'A water tank is 3/4 full. If its total capacity is 200 liters, how much water is inside?', options: ['120 L', '140 L', '150 L', '180 L'], correctAnswer: '150 L', topic: 'fractions', grade: 'UNT', difficulty, explanation: '3/4 of 200 is 150.' },
    ],
    unt_history_kz: [
      { question: 'In which year did Kazakhstan declare independence?', options: ['1989', '1990', '1991', '1992'], correctAnswer: '1991', topic: 'independence', grade: 'UNT', difficulty, explanation: 'Kazakhstan declared independence on December 16, 1991.' },
      { question: 'The Kazakh Khanate is generally considered to have been founded in:', options: ['1365', '1465', '1565', '1665'], correctAnswer: '1465', topic: 'Kazakh Khanate', grade: 'UNT', difficulty, explanation: 'Its formation is linked to Kerey and Janibek around 1465.' },
      { question: 'Who was the first President of independent Kazakhstan?', options: ['Kassym-Jomart Tokayev', 'Nursultan Nazarbayev', 'Dinmukhamed Kunaev', 'Askar Mamin'], correctAnswer: 'Nursultan Nazarbayev', topic: 'independent Kazakhstan', grade: 'UNT', difficulty, explanation: 'Nazarbayev was the first president after independence.' },
      { question: 'Which ancient tribes are strongly associated with early Kazakhstan history?', options: ['Vikings', 'Saka', 'Gauls', 'Aztecs'], correctAnswer: 'Saka', topic: 'ancient history', grade: 'UNT', difficulty, explanation: 'Saka tribes are central to ancient steppe history.' },
      { question: 'What is the current capital city of Kazakhstan?', options: ['Almaty', 'Astana', 'Shymkent', 'Karaganda'], correctAnswer: 'Astana', topic: 'modern Kazakhstan', grade: 'UNT', difficulty, explanation: 'Astana is the current capital.' },
    ],
    unt_profile_math: [
      { question: 'Solve for x: 2x + 7 = 19', options: ['4', '5', '6', '7'], correctAnswer: '6', topic: 'algebra', grade: 'UNT profile', difficulty, explanation: '2x = 12, so x = 6.' },
      { question: 'If f(x) = x^2, then f(5) =', options: ['10', '15', '20', '25'], correctAnswer: '25', topic: 'functions', grade: 'UNT profile', difficulty, explanation: 'Substitute x=5: 5^2=25.' },
      { question: 'What is sin(30°)?', options: ['1', 'sqrt(3)/2', '1/2', '0'], correctAnswer: '1/2', topic: 'trigonometry', grade: 'UNT profile', difficulty, explanation: 'sin(30°)=1/2 is a standard trig value.' },
      { question: 'The area of a circle with radius 3 is:', options: ['6pi', '9pi', '12pi', '18pi'], correctAnswer: '9pi', topic: 'geometry', grade: 'UNT profile', difficulty, explanation: 'Area = pi r^2 = pi * 9 = 9pi.' },
      { question: 'How many ways can you choose 2 students from 5?', options: ['5', '8', '10', '12'], correctAnswer: '10', topic: 'combinatorics', grade: 'UNT profile', difficulty, explanation: 'C(5,2)=10.' },
    ],
    unt_profile_physics: [
      { question: 'Which formula correctly expresses Newton\'s second law?', options: ['F = mv', 'F = ma', 'P = IV', 'E = mc'], correctAnswer: 'F = ma', topic: 'mechanics', grade: 'UNT profile', difficulty, explanation: 'Newton\'s second law states force equals mass times acceleration.' },
      { question: 'The SI unit of electric current is:', options: ['Volt', 'Ohm', 'Ampere', 'Watt'], correctAnswer: 'Ampere', topic: 'electricity', grade: 'UNT profile', difficulty, explanation: 'Current is measured in amperes (A).' },
      { question: 'Light bends when passing from air into water due to:', options: ['reflection', 'diffraction', 'refraction', 'dispersion only'], correctAnswer: 'refraction', topic: 'optics', grade: 'UNT profile', difficulty, explanation: 'Change in medium causes refraction (bending).' },
      { question: 'If a body moves at constant velocity, the net force on it is:', options: ['positive', 'negative', 'zero', 'infinite'], correctAnswer: 'zero', topic: 'mechanics', grade: 'UNT profile', difficulty, explanation: 'Constant velocity means zero acceleration, hence zero net force.' },
      { question: 'Which process best describes heat transfer through direct contact?', options: ['radiation', 'conduction', 'convection', 'diffusion'], correctAnswer: 'conduction', topic: 'thermodynamics', grade: 'UNT profile', difficulty, explanation: 'Conduction is heat transfer through direct particle interaction.' },
    ],
  };

  const source = bankBySubject[subject] || bankBySubject.math;
  const questions: NisBilQuestion[] = [];
  for (let i = 0; i < count; i += 1) {
    questions.push(source[i % source.length]);
  }

  return questions;
}

export async function generateNisBilQuestions(params: {
  count: number;
  gradeLabel: string;
  difficulty: NisBilDifficulty;
  topic: string;
  language: QuestionLanguage;
  subject: QuestionSubject;
  difficultyValue?: number; // Numeric difficulty for fallback purposes
}) {
  const hasGroqKey = !!process.env.GROQ_API_KEY;
  
  if (hasGroqKey) {
    try {
      ensureGroqConfigured();

      const userPrompt = buildGroqUserPrompt({
        count: params.count,
        gradeLabel: params.gradeLabel,
        difficulty: params.difficulty,
        topic: params.topic,
        language: params.language,
        subject: params.subject,
      });
      
      let systemPrompt: string;
      switch (params.subject) {
        case 'logic':
          systemPrompt = GROQ_SYSTEM_PROMPT_LOGIC;
          break;
        case 'english':
          systemPrompt = GROQ_SYSTEM_PROMPT_ENGLISH;
          break;
        case 'physics':
          systemPrompt = GROQ_SYSTEM_PROMPT_PHYSICS;
          break;
        case 'chemistry':
          systemPrompt = GROQ_SYSTEM_PROMPT_CHEMISTRY;
          break;
        case 'biology':
          systemPrompt = GROQ_SYSTEM_PROMPT_BIOLOGY;
          break;
        case 'geography':
          systemPrompt = GROQ_SYSTEM_PROMPT_GEOGRAPHY;
          break;
        case 'history':
          systemPrompt = GROQ_SYSTEM_PROMPT_HISTORY;
          break;
        case 'informatics':
          systemPrompt = GROQ_SYSTEM_PROMPT_INFORMATICS;
          break;
        case 'bil_math_logic':
          systemPrompt = GROQ_SYSTEM_PROMPT_BIL_MATH_LOGIC;
          break;
        case 'kazakh':
          systemPrompt = GROQ_SYSTEM_PROMPT_KAZAKH;
          break;
        case 'history_kz':
          systemPrompt = GROQ_SYSTEM_PROMPT_HISTORY_KZ;
          break;
        case 'ielts_reading':
          systemPrompt = GROQ_SYSTEM_PROMPT_IELTS_READING;
          break;
        case 'ielts_writing':
          systemPrompt = GROQ_SYSTEM_PROMPT_IELTS_WRITING;
          break;
        case 'ielts_vocab':
          systemPrompt = GROQ_SYSTEM_PROMPT_IELTS_VOCAB;
          break;
        case 'unt_reading':
          systemPrompt = GROQ_SYSTEM_PROMPT_UNT_READING;
          break;
        case 'unt_math_literacy':
          systemPrompt = GROQ_SYSTEM_PROMPT_UNT_MATH_LITERACY;
          break;
        case 'unt_history_kz':
          systemPrompt = GROQ_SYSTEM_PROMPT_UNT_HISTORY_KZ;
          break;
        case 'unt_profile_math':
          systemPrompt = GROQ_SYSTEM_PROMPT_UNT_PROFILE_MATH;
          break;
        case 'unt_profile_physics':
          systemPrompt = GROQ_SYSTEM_PROMPT_UNT_PROFILE_PHYSICS;
          break;
        default:
          systemPrompt = GROQ_SYSTEM_PROMPT_MATH;
      }
      systemPrompt = `${systemPrompt} ${getLanguageInstruction(params.language)}`;
      
      // Try to get questions from Groq with retry logic
      const completion = await createGroqCompletionWithRetry(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        true
      );

      const content = completion?.choices?.[0]?.message?.content;
      if (!content || typeof content !== 'string') {
        throw new Error('Groq returned an empty response');
      }

      if (params.subject === 'ielts_reading') {
        return parseGroqReadingPassage(content);
      }
      return parseGroqQuestions(content);
    } catch (error: any) {
      // Log the error for backend debugging
      console.error('Groq question generation failed, falling back to database:', {
        error: error.message,
        params: {
          gradeLabel: params.gradeLabel,
          difficulty: params.difficulty,
          topic: params.topic,
          language: params.language,
          subject: params.subject,
        },
        timestamp: new Date().toISOString(),
      });
    }
  } else {
    console.log('[generateNisBilQuestions] GROQ_API_KEY not configured, using database fallback immediately');
  }

  // Fallback to database questions
  try {
    const difficultyValue = params.difficultyValue || (params.difficulty === 'hard' ? 9 : params.difficulty === 'medium' ? 6 : 3);
    const fallbackQuestions = await getFallbackQuestionsFromDatabase(
      difficultyValue,
      params.count,
      params.subject
    );
    
    if (fallbackQuestions.length > 0) {
      console.log(`[generateNisBilQuestions] Fallback successful: retrieved ${fallbackQuestions.length} questions from database for subject: ${params.subject}`);
      return fallbackQuestions;
    }
    
    console.error('[generateNisBilQuestions] Database fallback returned 0 questions for subject:', params.subject);
    throw new Error('No fallback questions available in database');
  } catch (fallbackError: any) {
    console.error('[generateNisBilQuestions] Fallback to database also failed:', fallbackError.message);
    console.log('[generateNisBilQuestions] Using built-in fallback questions for subject:', params.subject);
    return getBuiltInFallbackQuestions(params.count, params.subject, params.difficulty);
  }
}
