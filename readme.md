# Setup

## Install dependency
```bash
npm i
```

## Environment
buat file baru dengan nama `.env` dan salin isi dari `.env.example` ke dalamnya. kemudian sesuaikan variable `DATABASE_URL` dengan url local.

# Penjelasan src

aplikasi ini dibuat menggunakan typescript, dengan dependensi ke prisma dan express. dengan implement repository pattern agar semua query disimpan dalam 1 file, tidak tersebar dimana mana.

## src/main.ts
file ini berisi http server yg dibuat dengan express dengan endpoint `/api/notifications` dan `/internal/queue/stats`. 

untuk menjalankan, gunakan perintah:
```bash
npm run app
```

## src/worker.ts
file ini berisi logika untuk menjalankan job yang dibuat saat meng-call endpoint `/api/notifications`. 

untuk menjalankan, gunakan perintah:
```bash
npm run worker
```

## src/repository.ts
file ini berisi query-query ke database. digunakan oleh `main.ts` dan `worker.ts`

## src/NotificationSender.ts
file ini berisi class untuk mengirim email. menggunakan interface `Sender` agar semua class mempunyai method yg sama dan base class `NotificationSender` untuk di extend oleh class `EmailSender` dan `SmsSender`.

## src/helper.ts
file ini berisi fungsi-fungsi untuk mempermudah development.

# Penjelasan kode

setelah menjalankan main.ts, aplikasi siap untuk menerima job. anda bisa membuat job lewat postman atau script yg sudah disediakan. 

setelah job ada di database, worker akan mencari job yg statusnya PENDING dan RETRY. 
```ts
const pendingAndRetryableJob = await getPendingAndRetryableJobs()
```

kemudian hasilnya akan di filter agar `next_run_at` sesuai dengan waktu saat ini. kemudian di loop agar menjalankan fungsi `processJob`. 

### Note

di fungsi runWorker ada bagian seperti:
```ts
let IS_FIRST_RUN = loadIsFirstRun()
console.log('IS_FIRST_RUN', IS_FIRST_RUN)
let startTriggerErrorIndex: number = 0
```

bagian ini untuk kebutuhan simulasi trigger error. mengkalkulasi job ke berapa yg akan di trigger error, banyaknya adalah 30% job.

dan hasilnya dimasukan ke dalam fungsi `processJob`.
```ts
processJob(job, i >= startTriggerErrorIndex && IS_FIRST_RUN).catch(err => { console.error(err) }));
```

dan nanti akan di clear oleh:
```ts
// clear
process.on('exit', () => {
  removeIsFirstRunFile()
})
```

## Eksekusi
dan untuk eksekusi job nya ada di bagian: 
```ts
const promises: Promise<void>[] = [];

jobsToProcess.forEach((job, i) => {
  promises.push(processJob(job, i >= startTriggerErrorIndex && IS_FIRST_RUN).catch(err => { console.error(err) }));
});

removeIsFirstRun() // tidak termasuk
await Promise.all(promises)
```

bagian ini membuat promise untuk masing-masing job. yang kemudian dimasukan ke variable `promises`, yang kemudian diakhir akan di wait oleh `Promise.all`.

saya menggunakan Promise.all karna jika meng-await satu persatu job itu artinya eksekusi job menjadi blocking. jadi saya memutuskan untuk menghandle semuanya di `Promise.all`.

### Kenapa pakai async-await? bukan worker thread?

karena di real-world, mengirim email itu termasuk I/O bound, bukan CPU bound. yang artinya jika saya membuat worker dengan worker thread, yang ada saya hanya menambah overhead ke CPU tanpa menambah efisiensi. 


kemudian berikut isi dari fungsi `processJob`:
```ts
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
```

sebagian sudah saya jelaskan maksudnya di komentar, disini saya jelaskan yang belum:

```ts
await setJobAsProcessing(job.id)
const rowVersion = await getRowVersion(job.id)
```

saya meng-update row dengan status `PROCESSING`. kemudian mengambil versi row dengan `getRowVersion`. yang isinya seperti ini:
```ts
export async function getRowVersion(id: string) {
  const result = await prisma.$queryRaw<{ xmin: string }[]>`
    SELECT xmin::text AS xmin
    FROM "notification_jobs"
    WHERE id = ${id}::uuid;
  `;

  return result[0]?.xmin ?? null;
}
```

saya menggunakan `xmin` untuk trace terakhir kolom diubah. ini termasuk ke cara saya handle race condition.

saya tidak menggunakan mutex di kodenya langsung karena di nodejs, mutex sendiri tidak native, perlu external package. dan tidak menggunakan transaction di database karna ada keperluan melihat status lewat endpoint `/internal/queue/stats`. karna jika menggunakan transaction dan kemudian meng-call api `/internal/queue/stats`, hasilnya akan selalu 0 di bagian processing karna commit transactionnya pasti selalu di akhir proses. jadi yg muncul hanya akan RETRY, FAILED, PENDING, SUCCESS. 

kemudian ini bagian untuk handling error:
```ts
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
```

fungsi `calculateJitter` digunakan untuk menambah value di nextRun nantinya, sebanyak 0%-30% dari base delay, yaitu `nextFiveSeconds`. 

kemudian jika retry sudah lebih dari max_attemps, maka job akan di set FAILED dan tidak akan di ambil lagi oleh worker.

sebelum mengirim notification, disini pengecekan race condition:
```ts
// before send notification, check the row version
const latestRowVersion = await getRowVersion(job.id)
if (rowVersion === latestRowVersion) {
  await sendNotification(job.channel, job.recipient, job.message)
} else {
  throw new Error(`gagal mengirim notif. sudah dikerjakan oleh worker lain`);
}
```

di bagian ini saya cek apakah xmin(versi row) masih sama saat job di get atau sudah berbeda? dengan asumsi ketika worker lain sudah ke bagian `await setJobAsProcessing(job.id)`, maka versi row sudah berbeda, yang artinya worker lain sudah handle job ini. dan kemudian tidak akan mengirim notification dan meng-throw error, `gagal mengirim notif. sudah dikerjakan oleh worker lain`.

lalu bagian:
```ts
await setJobAsSuccess(job.id)
log(`berhasil mengirim notifikasi ke ${job.recipient}`)
```

akan dieksekusi jika semua pengkondisian diatasnya berhasil dilewati.

dan worker akan berjalan setiap 5 detik sekali:
```ts
runWorker()
  .catch(err => console.error(err))// run untuk pertama kali

setInterval(() => {
  runWorker().catch(err => console.error(err))
}, 5 * 1000);
```

dan menggunakan `.catch` agar aplikasi tidak crash ketika ada error.

# Simulasi pengetesan