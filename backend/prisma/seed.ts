/// <reference types="node" />
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const questions = [
  // Difficulty 1 - Basic
  { text: "2 + 2 = ?", difficulty: 1, options: ["3", "4", "5", "6"], correctAnswer: 1 },
  { text: "3 + 5 = ?", difficulty: 1, options: ["7", "8", "9", "10"], correctAnswer: 1 },
  { text: "10 - 3 = ?", difficulty: 1, options: ["5", "6", "7", "8"], correctAnswer: 1 },
  { text: "2 × 3 = ?", difficulty: 1, options: ["5", "6", "7", "8"], correctAnswer: 1 },
  { text: "10 ÷ 2 = ?", difficulty: 1, options: ["4", "5", "6", "7"], correctAnswer: 1 },
  
  // Difficulty 2
  { text: "15 + 7 = ?", difficulty: 2, options: ["20", "21", "22", "23"], correctAnswer: 2 },
  { text: "30 - 8 = ?", difficulty: 2, options: ["20", "21", "22", "23"], correctAnswer: 2 },
  { text: "5 × 4 = ?", difficulty: 2, options: ["18", "19", "20", "21"], correctAnswer: 2 },
  { text: "24 ÷ 4 = ?", difficulty: 2, options: ["5", "6", "7", "8"], correctAnswer: 1 },
  { text: "12 + 13 = ?", difficulty: 2, options: ["24", "25", "26", "27"], correctAnswer: 1 },
  
  // Difficulty 3
  { text: "25 + 35 = ?", difficulty: 3, options: ["55", "60", "65", "70"], correctAnswer: 1 },
  { text: "100 - 32 = ?", difficulty: 3, options: ["66", "67", "68", "69"], correctAnswer: 2 },
  { text: "7 × 8 = ?", difficulty: 3, options: ["54", "55", "56", "57"], correctAnswer: 2 },
  { text: "81 ÷ 9 = ?", difficulty: 3, options: ["8", "9", "10", "11"], correctAnswer: 1 },
  { text: "42 + 28 = ?", difficulty: 3, options: ["68", "69", "70", "71"], correctAnswer: 2 },
  
  // Difficulty 4
  { text: "125 + 87 = ?", difficulty: 4, options: ["210", "211", "212", "213"], correctAnswer: 2 },
  { text: "200 - 75 = ?", difficulty: 4, options: ["123", "124", "125", "126"], correctAnswer: 2 },
  { text: "12 × 9 = ?", difficulty: 4, options: ["105", "106", "107", "108"], correctAnswer: 3 },
  { text: "144 ÷ 12 = ?", difficulty: 4, options: ["10", "11", "12", "13"], correctAnswer: 2 },
  { text: "89 + 56 = ?", difficulty: 4, options: ["143", "144", "145", "146"], correctAnswer: 3 },
  
  // Difficulty 5
  { text: "345 + 298 = ?", difficulty: 5, options: ["640", "641", "642", "643"], correctAnswer: 3 },
  { text: "500 - 187 = ?", difficulty: 5, options: ["312", "313", "314", "315"], correctAnswer: 1 },
  { text: "15 × 14 = ?", difficulty: 5, options: ["209", "210", "211", "212"], correctAnswer: 1 },
  { text: "256 ÷ 16 = ?", difficulty: 5, options: ["14", "15", "16", "17"], correctAnswer: 2 },
  { text: "234 + 567 = ?", difficulty: 5, options: ["799", "800", "801", "802"], correctAnswer: 2 },
  
  // Difficulty 6
  { text: "1234 + 5678 = ?", difficulty: 6, options: ["6910", "6911", "6912", "6913"], correctAnswer: 3 },
  { text: "1000 - 234 = ?", difficulty: 6, options: ["764", "765", "766", "767"], correctAnswer: 2 },
  { text: "25 × 24 = ?", difficulty: 6, options: ["598", "599", "600", "601"], correctAnswer: 2 },
  { text: "625 ÷ 25 = ?", difficulty: 6, options: ["24", "25", "26", "27"], correctAnswer: 1 },
  { text: "789 + 456 = ?", difficulty: 6, options: ["1243", "1244", "1245", "1246"], correctAnswer: 3 },
  
  // Difficulty 7
  { text: "2345 + 6789 = ?", difficulty: 7, options: ["9132", "9133", "9134", "9135"], correctAnswer: 3 },
  { text: "5000 - 1234 = ?", difficulty: 7, options: ["3764", "3765", "3766", "3767"], correctAnswer: 2 },
  { text: "32 × 35 = ?", difficulty: 7, options: ["1118", "1119", "1120", "1121"], correctAnswer: 3 },
  { text: "1024 ÷ 32 = ?", difficulty: 7, options: ["30", "31", "32", "33"], correctAnswer: 2 },
  { text: "3456 + 2789 = ?", difficulty: 7, options: ["6244", "6245", "6246", "6247"], correctAnswer: 1 },
  
  // Difficulty 8
  { text: "12345 + 54321 = ?", difficulty: 8, options: ["66665", "66666", "66667", "66668"], correctAnswer: 1 },
  { text: "10000 - 3456 = ?", difficulty: 8, options: ["6542", "6543", "6544", "6545"], correctAnswer: 2 },
  { text: "45 × 47 = ?", difficulty: 8, options: ["2114", "2115", "2116", "2117"], correctAnswer: 2 },
  { text: "2048 ÷ 64 = ?", difficulty: 8, options: ["30", "31", "32", "33"], correctAnswer: 2 },
  { text: "7654 + 3456 = ?", difficulty: 8, options: ["11109", "11110", "11111", "11112"], correctAnswer: 2 },
  
  // Difficulty 9
  { text: "123456 + 654321 = ?", difficulty: 9, options: ["777776", "777777", "777778", "777779"], correctAnswer: 1 },
  { text: "100000 - 12345 = ?", difficulty: 9, options: ["87653", "87654", "87655", "87656"], correctAnswer: 2 },
  { text: "56 × 78 = ?", difficulty: 9, options: ["4366", "4367", "4368", "4369"], correctAnswer: 3 },
  { text: "4096 ÷ 64 = ?", difficulty: 9, options: ["62", "63", "64", "65"], correctAnswer: 2 },
  { text: "56789 + 43210 = ?", difficulty: 9, options: ["99998", "99999", "100000", "100001"], correctAnswer: 2 },
  
  // Difficulty 10 - Advanced
  { text: "987654 + 123456 = ?", difficulty: 10, options: ["1111109", "1111110", "1111111", "1111112"], correctAnswer: 2 },
  { text: "500000 - 123456 = ?", difficulty: 10, options: ["376543", "376544", "376545", "376546"], correctAnswer: 1 },
  { text: "75 × 89 = ?", difficulty: 10, options: ["6673", "6674", "6675", "6676"], correctAnswer: 3 },
  { text: "8192 ÷ 128 = ?", difficulty: 10, options: ["62", "63", "64", "65"], correctAnswer: 2 },
  { text: "234567 + 765432 = ?", difficulty: 10, options: ["999998", "999999", "1000000", "1000001"], correctAnswer: 2 },
];

async function main() {
  console.log('Starting seed...');
  
  // Clear existing data
  await prisma.gameAnswer.deleteMany();
  await prisma.gameQuestion.deleteMany();
  await prisma.gamePlayer.deleteMany();
  await prisma.game.deleteMany();
  await prisma.question.deleteMany();
  await prisma.user.deleteMany();

  // Seed questions
  for (const q of questions) {
    await prisma.question.create({
      data: {
        text: q.text,
        difficulty: q.difficulty,
        options: JSON.stringify(q.options),
        correctAnswer: q.correctAnswer,
        language: 'english',
        subject: 'math',
      } as any,
    });
  }

  // Add some logic questions
  const logicQuestions = [
    { text: "What comes next: 2, 4, 6, 8, ?", difficulty: 2, options: ["9", "10", "11", "12"], correctAnswer: 1, subject: "logic" },
    { text: "If A > B and B > C, then: A > C (True/False)", difficulty: 3, options: ["True", "False", "Cannot determine", "Unknown"], correctAnswer: 0, subject: "logic" },
    { text: "Complete the analogy: Apple is to Fruit as Carrot is to ?", difficulty: 3, options: ["Orange", "Vegetable", "Plant", "Food"], correctAnswer: 1, subject: "logic" },
    { text: "What number should replace the ?: 1, 1, 2, 3, 5, 8, ?", difficulty: 4, options: ["11", "12", "13", "14"], correctAnswer: 2, subject: "logic" },
    { text: "Which one doesn't belong: Cat, Dog, Whale, Sparrow", difficulty: 3, options: ["Cat", "Dog", "Whale", "Sparrow"], correctAnswer: 2, subject: "logic" },
    { text: "If all roses are flowers and flowers are plants, then roses are plants (True/False)", difficulty: 3, options: ["True", "False", "Cannot determine", "Unknown"], correctAnswer: 0, subject: "logic" },
    { text: "Pattern: 3, 6, 12, 24, ?", difficulty: 3, options: ["36", "48", "60", "72"], correctAnswer: 1, subject: "logic" },
    { text: "What comes next: A, B, D, G, K, ?", difficulty: 4, options: ["M", "N", "O", "P"], correctAnswer: 3, subject: "logic" },
    { text: "If a bottle contains 2 liters and you drink 0.5 liters per day, how many days until it is empty?", difficulty: 2, options: ["2", "3", "4", "5"], correctAnswer: 2, subject: "logic" },
    { text: "Complete: Monday, Tuesday, Wednesday, ?", difficulty: 1, options: ["Friday", "Thursday", "Saturday", "Sunday"], correctAnswer: 1, subject: "logic" },
  ];

  for (const q of logicQuestions) {
    await prisma.question.create({
      data: {
        text: q.text,
        difficulty: q.difficulty,
        options: JSON.stringify(q.options),
        correctAnswer: q.correctAnswer,
        language: 'english',
        subject: q.subject,
        explanation: 'See the pattern in the sequence.',
      } as any,
    });
  }

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
