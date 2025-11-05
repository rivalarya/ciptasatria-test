import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '../generated/prisma/client';
const prisma = new PrismaClient();

export async function getPendingAndRetryableJobs() {
  return await prisma.notificationJob.findMany({
    where: {
      status: {
        in: ['PENDING', 'RETRY']
      },
    }
  });
}

export async function createNotificationJob(recipient: string, channel: string, message: string, idempotency_key: string) {
  return await prisma.notificationJob.create({
    data: {
      recipient,
      channel,
      message,
      idempotency_key,
      next_run_at: new Date(Date.now()),
    }
  });
}

export async function getNotificationJobWithSameIdempotencyKey(idempotency_key: string) {
  return await prisma.notificationJob.findFirst({
    where: {
      idempotency_key,
    },
  });
}
