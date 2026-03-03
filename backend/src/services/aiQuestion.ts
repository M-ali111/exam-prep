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

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

export type NisBilDifficulty = 'easy' | 'medium' | 'hard';
export type QuestionLanguage = 'english' | 'russian' | 'kazakh';
export type QuestionSubject = 'math' | 'logic';

export interface NisBilQuestion {
  question: string;
  options: [string, string, string, string];
  correctAnswer: string;
  topic: string;
  grade: string;
  difficulty: NisBilDifficulty;
  explanation: string;
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
  const subjectName = params.subject === 'logic' ? 'Logic & IQ' : 'Math';
  const subjectDescription = params.subject === 'logic' 
    ? 'logic and IQ questions testing pattern recognition, logical reasoning, analogies, and matrix reasoning'
    : 'math questions';
  
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
  // Clean the response first
  const cleanedRaw = cleanJsonResponse(raw);
  
  let parsed: any;
  try {
    parsed = JSON.parse(cleanedRaw);
  } catch (error) {
    throw new Error('Groq returned invalid JSON after cleaning');
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

    const correctAnswer = item.correctAnswer.trim();
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
      const systemPrompt = params.subject === 'logic' 
        ? `${GROQ_SYSTEM_PROMPT_LOGIC} ${getLanguageInstruction(params.language)}`
        : `${GROQ_SYSTEM_PROMPT_MATH} ${getLanguageInstruction(params.language)}`;
      
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
    throw new Error(`Unable to generate or retrieve questions. Database error: ${fallbackError.message}`);
  }
}
