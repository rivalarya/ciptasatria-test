import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
dotenv.config();
import { createNotificationJob, getNotificationJobWithSameIdempotencyKey } from './repository';

const app = express();
app.use(express.json());

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
    const getTheSameIdempotencyKey = await getNotificationJobWithSameIdempotencyKey(idempotency_key)

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

    const notificationJob = await createNotificationJob(recipient, channel, message, idempotency_key)

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

