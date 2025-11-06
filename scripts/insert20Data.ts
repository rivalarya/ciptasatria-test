import dotenv from 'dotenv';
import { PrismaClient } from '../generated/prisma/client'

dotenv.config();

const prisma = new PrismaClient();

export default async function main() {
  for (let i = 1; i <= 20; i++) {
    const data = {
      recipient: `user${i}@example.com`,
      channel: 'email',
      message: 'Halo dari sistem worker!',
      idempotency_key: null,
      next_run_at: new Date(Date.now())
    };

    await prisma.notificationJob.create({ data });
  }

  console.log('berhasil insert 20 data')
}
