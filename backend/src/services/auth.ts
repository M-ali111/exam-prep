import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateToken } from '../utils/jwt';

const prisma = new PrismaClient();

export const authService = {
  async signup(
    email: string,
    username: string,
    password: string,
    schoolName: string,
    city: string,
    centerName: string
  ) {
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existingUser) {
      throw new Error('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        schoolName,
        city,
        centerName,
        password: hashedPassword,
      },
    });

    const token = generateToken(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        schoolName: user.schoolName,
        city: user.city,
        centerName: user.centerName,
        rating: user.rating,
        currentDifficulty: user.currentDifficulty,
      },
      token,
    };
  },

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new Error('Invalid password');
    }

    const token = generateToken(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        schoolName: user.schoolName,
        city: user.city,
        centerName: user.centerName,
        rating: user.rating,
        currentDifficulty: user.currentDifficulty,
      },
      token,
    };
  },

  async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        schoolName: true,
        city: true,
        centerName: true,
        rating: true,
        currentDifficulty: true,
        totalGamesPlayed: true,
        totalWins: true,
        bestScore: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  },

  async getUserStats(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const games = await prisma.gamePlayer.findMany({
      where: { userId },
    });

    const totalGames = games.length;
    const totalWins = games.filter((g) => g.isWinner).length;
    const winRate = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(2) : 0;

    return {
      user,
      totalGames,
      totalWins,
      winRate,
    };
  },

  async deleteAccount(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Related game/answer/streak records are removed via Prisma cascade rules.
    await prisma.user.delete({
      where: { id: userId },
    });
  },
};
