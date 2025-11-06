import dotenv from 'dotenv';
import { PrismaClient } from '../generated/prisma/client';

dotenv.config();

const prisma = new PrismaClient();

export async function truncateTable() {
  try {
    await prisma.notificationJob.deleteMany({});
    console.log('table truncated');
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}