import { Injectable, Logger } from '@nestjs/common';
// import * as TelegramBot from 'node-telegram-bot-api';
import { NotificationPayload, NotificationService } from './interfaces/notification.interface';

@Injectable()
export class TelegramNotificationService implements NotificationService {
  private readonly logger = new Logger(TelegramNotificationService.name);
  private readonly bot: any; //TelegramBot;
  private readonly managerChatIds: Record<string, string> = {
    'Surf School': 'TELEGRAM_SURF_SCHOOL_MANAGER_ID', // Replace with actual Telegram ID
    'Sports Club': 'TELEGRAM_SPORTS_CLUB_MANAGER_ID',
    'Villa Booking': 'TELEGRAM_ACCOMMODATION_MANAGER_ID',
    'Good History': '79226360023', // Fallback
  };

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is not defined');
    }
    // this.bot = new TelegramBot(token, { polling: true });
    // this.bot.on('message', msg => {
    //   console.log('msg: ', msg);
    //   this.bot.sendMessage(msg.chat.id, 'I am alive!');
    // });
  }

  public async test() {
    this.bot.on('message', (msg) => {
      console.log('msg: ', msg);

      this.bot.sendMessage(msg.chat.id, 'I am alive!');
    });
  }

  async sendNotification(payload: NotificationPayload): Promise<void> {
    const { chatId, userId, message } = payload;
    // const chatId = this.managerChatIds[business] || this.managerChatIds['Good History'];

    if (!chatId) {
      this.logger.error(`No manager chat ID found for: ${chatId}`);
      throw new Error(`No manager chat ID configured for ${chatId}`);
    }

    const telegramMessage = `New query from user ${userId}: "${message}"`;

    try {
      await this.bot.sendMessage(chatId, telegramMessage);
      this.logger.log(`Notification sent to ${chatId} manager (${chatId}): ${telegramMessage}`);
    } catch (error) {
      this.logger.error(`Failed to send Telegram notification to ${chatId}: ${error.message}`);
      throw error;
    }
  }
}
