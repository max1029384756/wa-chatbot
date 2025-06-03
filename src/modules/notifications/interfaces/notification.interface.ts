export interface NotificationPayload {
  chatId: string;
  userId: string;
  message: string;
}

export interface NotificationService {
  sendNotification(payload: NotificationPayload): Promise<void>;
}
