import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '@/modules/ai/ai.service';
import { IWebhookHandler } from '@/modules/webhook/webhook-handler.interface';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { MessageHistoryService } from '@/modules/message-history/message-history.service';
import { InstagramObject } from '@/modules/instagram/interfaces/instagram.object.interface';
import { PROVIDERS } from '@/modules/message-history/providers.constants';
import { DeveloperAlertService } from '@/modules/developer-alert/developer-alert.service';

@Injectable()
export class InstagramService implements IWebhookHandler {
  private readonly logger = new Logger(InstagramService.name);
  private static readonly HEART_RESPONSE = '\u2764\uFE0F';
  private static readonly EMOJI_CHARACTER_REGEX = /[\u203C-\u3299\u{1F000}-\u{1FAFF}]/u;

  constructor(
    private readonly aiService: AiService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly messageHistoryService: MessageHistoryService,
    private readonly developerAlertService: DeveloperAlertService,
  ) {}

  async handleWebhook(payload: any): Promise<any> {
    this.logger.debug('Received Instagram webhook', payload);
    // Call aiService or other logic as needed
    // return { status: 'received', source: 'instagram' };

    // TODO: handle no text messages

    const { id: instagramUserId } = payload.entry?.[0] ?? {};
    const { sender, recipient, message, timestamp } = payload.entry?.[0]?.messaging?.[0] ?? {};

    if (!sender?.id || !recipient?.id || !message?.text) {
      this.logger.debug('Received message without text or sender, ignoring', message);
      return;
    }

    // TODO: for message field "is_echo": true; message.is_echo
    if (instagramUserId === sender.id) {
      this.logger.debug('Received message from the same user ID, ignoring message');
      return;
    }
    // сообщение от 6plwlugheam4 и отправитель я мой макскор акк
    // if (instagramUserId !== '17841475555245128' && sender.id !== '1089141306401636') {
    //   this.logger.debug('Not me inst message, ignoring message');
    //   return;
    // }

    // Respond with a heart when the payload looks like a story/reel reaction or an emoji-only nudge.
    if (this.shouldSkipRagAndSendHeart(message)) {
      await this.sendInstagramMessage(instagramUserId, recipient.id, sender.id, InstagramService.HEART_RESPONSE);
      return;
    }

    const start = Date.now();
    const aiResponse = await this.aiService.generateAIResponse(recipient.id, sender.id, message.text);
    const end = Date.now();

    let date: Date | undefined = undefined;
    if (timestamp) {
      const ms = Number(timestamp);
      date = new Date(ms);
    }
    await this.messageHistoryService.save({
      clientId: sender.id,
      question: message.text,
      answer: aiResponse,
      generationTime: (end - start) / 1000,
      ...(date && { date }),
      provider: PROVIDERS.INSTAGRAM,
    });

    await this.sendInstagramMessage(instagramUserId, recipient.id, sender.id, aiResponse);
  }

  public async handleTestWebhook(payload: InstagramObject): Promise<any> {
    this.logger.debug('Received Instagram webhook', payload);
    const { sender, recipient, message, timestamp } = payload.entry?.[0]?.messaging?.[0] ?? {};

    if (!sender?.id || !recipient?.id || !message?.text) {
      return undefined;
    }

    if (this.shouldSkipRagAndSendHeart(message)) {
      return InstagramService.HEART_RESPONSE;
    }

    const start = Date.now();
    const aiResponse = await this.aiService.generateAIResponse(recipient.id, sender.id, message.text);
    const end = Date.now();

    let date: Date | undefined = undefined;
    if (timestamp) {
      const ms = Number(timestamp);
      date = new Date(ms);
    }
    await this.messageHistoryService.save({
      clientId: sender.id,
      question: message.text,
      answer: aiResponse,
      generationTime: (end - start) / 1000,
      ...(date && { date }),
      provider: PROVIDERS.INSTAGRAM,
    });

    return aiResponse;
  }

  private getInstagramAccessTokenByUserId(instagramUserId: string): string | undefined {
    const accessTokens = this.configService.get<Record<string, string>>('services.instagram.accessTokens');
    // if (!accessTokens) {
    //   this.logger.warn('No Instagram accessTokens found in config');
    //   return undefined;
    // }
    const token = accessTokens[instagramUserId];
    // if (!token) {
    //   this.logger.warn(`No Instagram access token found for instagramUserId: ${instagramUserId}`);
    //   return undefined;
    // }
    return token;
  }

  private shouldSkipRagAndSendHeart(message: any): boolean {
    if (!message) {
      return false;
    }

    if (message.reply_to?.story || message.reply_to?.reel) {
      return true;
    }

    const normalizedText = message.text?.replace(/\s+/g, '') ?? '';
    if (!normalizedText) {
      return false;
    }

    // Treat short, emoji-only nudges as reactions to avoid running them through RAG.
    if (normalizedText.length <= 10 && InstagramService.isEmojiOnly(normalizedText)) {
      return true;
    }

    return false;
  }

  private static isEmojiOnly(text: string): boolean {
    if (!text) {
      return false;
    }

    return Array.from(text).every((char) => InstagramService.EMOJI_CHARACTER_REGEX.test(char));
  }

  private async sendInstagramMessage(
    instagramUserId: string,
    igId: string,
    userId: string,
    text: string,
  ): Promise<void> {
    const accessToken = this.getInstagramAccessTokenByUserId(instagramUserId);
    if (!accessToken) {
      this.logger.error(`No access token found for instagramUserId: ${instagramUserId}`);
      return;
    }

    const url = `https://graph.instagram.com/v23.0/${igId}/messages`;
    const body = {
      recipient: {
        id: userId,
      },
      message: {
        text,
      },
    };

    this.logger.debug({ url, body });

    try {
      const response = await lastValueFrom(
        this.httpService.post(url, body, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }),
      );

      this.logger.debug({ response: response.data });
    } catch (error: any) {
      const statusCode = error?.response?.status;

      if (statusCode === 401) {
        await this.developerAlertService.notifyInstagramAuthFailure({
          instagramUserId,
          igId,
          userId,
          statusCode,
          errorPayload: error?.response?.data,
        });
      }

      this.logger.error('Error sending inst message:', error);
    }
  }
}
