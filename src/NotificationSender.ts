interface Sender {
  send(email: string, message: string): void
}

export class NotificationSender implements Sender {
  send(recipient: string, message: string) {
    throw new Error("method is not implemented");
  }
}

export class EmailSender extends NotificationSender {
  send(recipient: string, message: string) {
    console.log(`sending EMAIL to ${recipient}. and the message is ${message}`)
  }
}

export class SmsSender extends NotificationSender {
  send(recipient: string, message: string) {
    console.log(`sending SMS to ${recipient}. and the message is ${message}`)
  }
}
