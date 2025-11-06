import { NotificationJob } from "../generated/prisma/client";
import { loadIsFirstRun, log, removeIsFirstRunFile, saveIsFirstRun, sleep } from "./helper";
import { EmailSender, SmsSender } from "./NotificationSender"
import { getPendingAndRetryableJobs, getRowVersion, setJobAsFailed, setJobAsProcessing, setJobAsRetry, setJobAsSuccess } from "./repository"

// hapus simulasi retry
function removeIsFirstRun() {
  saveIsFirstRun(false)
}

async function runWorker() {
  let IS_FIRST_RUN = loadIsFirstRun()
  console.log('IS_FIRST_RUN', IS_FIRST_RUN)
  let startTriggerErrorIndex: number = 0

  log('menjalankan worker')
  const pendingAndRetryableJob = await getPendingAndRetryableJobs()

  if (IS_FIRST_RUN) {
    const thirtyPercentOfData = Math.ceil(pendingAndRetryableJob.length * 0.3);
    log(`all data: ${pendingAndRetryableJob.length}`)
    log(`thirtyPercentOfData: ${thirtyPercentOfData}`)

    startTriggerErrorIndex = pendingAndRetryableJob.length - thirtyPercentOfData
    log(`trigger error di data ke ${startTriggerErrorIndex + 1}`)
  }


  const jobsToProcess = pendingAndRetryableJob.filter(job => job.next_run_at && job.next_run_at.getTime() <= Date.now())
  if (jobsToProcess.length === 0) {
    log('tidak ada job yang bisa diproses')
    removeIsFirstRun()
    return
  }
  const promises: Promise<void>[] = [];

  jobsToProcess.forEach((job, i) => {
    promises.push(processJob(job, i >= startTriggerErrorIndex && IS_FIRST_RUN).catch(err => { console.error(err) }));
  });

  removeIsFirstRun()
  await Promise.all(promises)
}

async function sendNotification(channel: string, recipient: string, message: string) {
  const emailSender = new EmailSender()
  const smsSender = new SmsSender()

  switch (channel) {
    case 'email':
      emailSender.send(recipient, message)
      break;
    case 'sms':
      smsSender.send(recipient, message)
      break;

    default:
      throw new Error("channel not found");
  }
}

async function processJob(
  job: NotificationJob,
  createError: boolean = false
) {
  try {
    await sleep(1000) // untuk memberikan worker lain waktu untuk masuk ke function ini. dan kemudian memicu race condition

    await setJobAsProcessing(job.id)
    const rowVersion = await getRowVersion(job.id)

    await sleep(2000)// simulasi proses

    // trigger an error. untuk simulasi retry
    if (createError) {
      const calculateJitter = (baseDelay: number) => baseDelay * (0.3 * Math.random());

      const nextFiveSeconds = 5 * 1000
      const attemps = job.attempts + 1
      const nextRun = (nextFiveSeconds * attemps) + calculateJitter(nextFiveSeconds)

      if (job.attempts >= job.max_attempts) {
        await setJobAsFailed(job.id, `gagal mengirim notif. telah mencapai batas maksimal`)
        throw new Error(`gagal mengirim notif. telah mencapai batas maksimal`);
      }
      await setJobAsRetry(job.id, attemps, nextRun)
      throw new Error(`gagal mengirim notif. akan dijalankan lagi di ${new Date(Date.now() + nextRun).toISOString()}`);
    }

    // before send notification, check the row version
    const latestRowVersion = await getRowVersion(job.id)
    if (rowVersion === latestRowVersion) {
      await sendNotification(job.channel, job.recipient, job.message)
    } else {
      throw new Error(`gagal mengirim notif. sudah dikerjakan oleh worker lain`);
    }

    await setJobAsSuccess(job.id)
    log(`berhasil mengirim notifikasi ke ${job.recipient}`)
  } catch (error) {
    const timestamp = new Date().toISOString();
    throw new Error(`${timestamp} - gagal memproses job ${job.id}, recipient: ${job.recipient}: ${error}`);
  }
}

runWorker()
  .catch(err => console.error(err))// run untuk pertama kali

setInterval(() => {
  runWorker().catch(err => console.error(err))
}, 5 * 1000);

// clear
process.on('exit', () => {
  removeIsFirstRunFile()
})
