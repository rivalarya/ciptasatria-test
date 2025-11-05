import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '../generated/prisma/client';

const app = express();
app.use(express.json());

const prisma = new PrismaClient();

type NotificationJobResponse = {
    job_id: string;
    status: 'PENDING' | 'PROCESSING' | 'RETRY' | 'SUCCESS' | 'FAILED';
}

app.post('/api/notifications', async (req: Request, res: Response) => {
    const { recipient, channel, message, idempotency_key } = req.body;

    if (!recipient || !channel || !message || !['email', 'sms'].includes(channel)) {
        return res.status(400).send('Bad request');
    }

    // validasi idempotency_key
    const getTheSameIdempotencyKey = await prisma.notificationJob.findFirst({
        where: {
            idempotency_key
        },
    })

    if (getTheSameIdempotencyKey != null) {
        const {
            id,
            status,
            recipient: duplicatedRecipient,
            channel: duplicatedChannel,
            message: duplicatedMessage
        } = getTheSameIdempotencyKey

        if (
            recipient === duplicatedRecipient
            && channel === duplicatedChannel
            && message === duplicatedMessage
        ) {
            console.log('job identik ditemukan. mengembalikan response tanpa membuat job baru...')
            const response: NotificationJobResponse = {
                job_id: id,
                status
            }

            return response
        }
    }

    const notificationJob = await prisma.notificationJob.create({
        data: {
            recipient,
            channel,
            message,
            idempotency_key,
            next_run_at: new Date(Date.now()),
        },
    });

    const response: NotificationJobResponse = {
        job_id: notificationJob.id,
        status: notificationJob.status
    }

    return res.status(201).json(response);
});


app.get('/internal/queue/stats', (req: Request, res: Response) => {
    res.send('Hello World!');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

