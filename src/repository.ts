import dotenv from 'dotenv';
dotenv.config();

import { NotificationJobStatus, PrismaClient } from '../generated/prisma/client';
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

export async function getRowVersion(id: string) {
  const result = await prisma.$queryRaw<{ xmin: string }[]>`
    SELECT xmin::text AS xmin
    FROM "notification_jobs"
    WHERE id = ${id}::uuid;
  `;

  return result[0]?.xmin ?? null;
}

export async function setJobAsProcessing(id: string) {
  await prisma.notificationJob.update({
    where: {
      id: id
    },
    data: {
      status: NotificationJobStatus.PROCESSING
    }
  })
}

export async function setJobAsRetry(id: string, attempts: number, nextRunAt: number) {
  await prisma.notificationJob.update({
    where: {
      id: id
    },
    data: {
      status: NotificationJobStatus.RETRY,
      attempts: attempts,
      next_run_at: new Date(Date.now() + nextRunAt)
    }
  })
}

export async function setJobAsFailed(id: string, error: string) {
  await prisma.notificationJob.update({
    where: {
      id: id
    },
    data: {
      status: NotificationJobStatus.FAILED,
      processed_at: new Date(Date.now()),
      last_error: error
    }
  })
}

export async function setJobAsSuccess(id: string) {
  await prisma.notificationJob.update({
    where: {
      id: id
    },
    data: {
      status: NotificationJobStatus.SUCCESS,
      processed_at: new Date(Date.now())
    }
  })
}

export async function getStats() {
  const pendingJobs = await prisma.notificationJob.count({
    where: {
      status: NotificationJobStatus.PENDING
    }
  })
  const retryJobs = await prisma.notificationJob.count({
    where: {
      status: NotificationJobStatus.RETRY
    }
  })
  const processingJobs = await prisma.notificationJob.count({
    where: {
      status: NotificationJobStatus.PROCESSING
    }
  })
  const successJobs = await prisma.notificationJob.count({
    where: {
      status: NotificationJobStatus.SUCCESS
    }
  })
  const failedJobs = await prisma.notificationJob.count({
    where: {
      status: NotificationJobStatus.FAILED
    }
  })
  const successJobsWithAttempts = await prisma.notificationJob.findMany({
    where: {
      status: NotificationJobStatus.SUCCESS
    },
    select: {
      attempts: true
    }
  })

  return {
    pendingJobs,
    retryJobs,
    processingJobs,
    successJobs,
    failedJobs,
    successJobsWithAttempts
  }
}