import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '@/modules/ai/ai.service';
import { IWebhookHandler } from '@/modules/webhook/webhook-handler.interface';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { BadRequestException } from '@nestjs/common';
import { MessageHistoryService } from '@/modules/message-history/message-history.service';
import { InstagramObject } from '@/modules/instagram/interfaces/instagram.object.interface';
import { PROVIDERS } from '@/modules/message-history/providers.constants';

@Injectable()
export class InstagramService implements IWebhookHandler {
  private readonly logger = new Logger(InstagramService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly messageHistoryService: MessageHistoryService,
  ) {}

  async handleWebhook(payload: any): Promise<any> {
    this.logger.debug('Received Instagram webhook', payload);
    // Call aiService or other logic as needed
    // return { status: 'received', source: 'instagram' };

    // TODO: handle no text messages

    const { id: instagramUserId } = payload.entry?.[0];
    const { sender, recipient, message, timestamp } = payload.entry?.[0]?.messaging[0];

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

    // TODO: Validating Payloads https://developers.facebook.com/docs/instagram-platform/webhooks
    const start = Date.now();
    const aiResponse = await this.aiService.generateAIResponse(recipient.id, sender.id, message.text);
    const end = Date.now();

    let date: Date | undefined = undefined;
    if (timestamp) {
      const ms = Number(timestamp) * 1000;
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

    const accessToken = this.getInstagramAccessTokenByUserId(instagramUserId);
    if (!accessToken) {
      this.logger.error(`No access token found for instagramUserId: ${instagramUserId}`);
      return;
    }

    const igId = recipient.id;
    const url = `https://graph.instagram.com/v23.0/${igId}/messages`;
    const body = {
      recipient: {
        id: sender.id,
      },
      message: {
        text: aiResponse,
      },
    };

    this.logger.debug({ url, body });

    try {
      const response = this.httpService
        .post(url, body, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        })
        .pipe(
          map((res) => {
            this.logger.log('Response:', res.data);
            return res.data;
          }),
        )
        .pipe(
          catchError((error) => {
            throw new BadRequestException(error);
          }),
        );

      const messageStatus = await lastValueFrom(response);

      this.logger.debug({ response: messageStatus });
    } catch (error) {
      this.logger.error('Error sending inst message:', error);
    }
  }

  public async handleTestWebhook(payload: InstagramObject): Promise<any> {
    this.logger.debug('Received Instagram webhook', payload);
    const { sender, recipient, message, timestamp } = payload.entry?.[0]?.messaging[0];

    const start = Date.now();
    const aiResponse = await this.aiService.generateAIResponse(recipient.id, sender.id, message.text);
    const end = Date.now();

    let date: Date | undefined = undefined;
    if (timestamp) {
      const ms = Number(timestamp) * 1000;
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
}
