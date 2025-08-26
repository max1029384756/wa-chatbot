import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { TelegramUpdate } from '@/modules/telegram/intefraces/telegram.update.interface';
import { AiService } from '@/modules/ai/ai.service';
import { MessageHistoryService } from '@/modules/message-history/message-history.service';
import { PROVIDERS } from '@/modules/message-history/providers.constants';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  private readonly apiUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

  constructor(
    private readonly http: HttpService,
    private readonly aiService: AiService,
    private readonly messageHistoryService: MessageHistoryService,
  ) {}

  async handleWebhook(payload: TelegramUpdate): Promise<string> {
    this.logger.debug('Received Telegram webhook', payload);

    const message = payload.message;

    if (!message) {
      this.logger.warn('No message found in webhook payload');
      return;
    }

    if (!message.text) {
      this.logger.debug(`Received non-text message: ${JSON.stringify(message)}`);
      return;
    }

    const chatId = message.chat.id;

    if (message.text === '/start') {
      await this.sendMessage(
        chatId,
        '👋 Welcome to Good Story! I can help you with accommodation, surf lessons, and our sports club. What would you like to know about?',
      );
      return;
    }

    const senderId = message.from.id;
    const userMessage = message.text;
    const date = message.date ? new Date(message.date * 1000) : new Date();

    // this.logger.debug(`Received text message: ${userMessage}`);

    // Pass through your RAG/OpenAI pipeline
    const start = Date.now();
    // const aiResponse = `Echo: ${userMessage}, date: ${date}`;
    const aiResponse = await this.aiService.generateAIResponse(chatId.toString(), senderId.toString(), userMessage);
    const end = Date.now();

    await this.messageHistoryService.save({
      clientId: senderId.toString(),
      question: userMessage,
      answer: aiResponse,
      generationTime: (end - start) / 1000,
      ...(date && { date }),
      provider: PROVIDERS.TELEGRAM,
    });

    await this.sendMessage(chatId, aiResponse);
  }

  async sendMessage(chatId: number, text: string) {
    await firstValueFrom(
      this.http.post(`${this.apiUrl}/sendMessage`, {
        chat_id: chatId,
        text,
      }),
    );
  }
}
