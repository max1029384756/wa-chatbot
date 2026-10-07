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
import { INSTAGRAM_MANAGED_ACCOUNTS } from './instagram-managed-accounts';

@Injectable()
export class InstagramService implements IWebhookHandler {
  private readonly logger = new Logger(InstagramService.name);
  private static readonly HEART_RESPONSE = '\u2764\uFE0F';
  private static readonly LOOP_NOTICE =
    'Служебное уведомление: ваше сообщение игнорируется, чтобы избежать автоматических ответов самому себе или между нашими аккаунтами. При необходимости обратитесь к разработчику.';
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

    const guard = await this.checkLoopGuard(instagramUserId, sender.id, recipient.id, message);
    if (guard === 'skip') return;
    if (guard === 'notice') {
      await this.sendInstagramMessage(instagramUserId, recipient.id, sender.id, InstagramService.LOOP_NOTICE);
      return;
    }

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
    const instagramUserId = payload.entry?.[0]?.id;
    const { sender, recipient, message, timestamp } = payload.entry?.[0]?.messaging?.[0] ?? {};

    if (!sender?.id || !recipient?.id || !message?.text) {
      return undefined;
    }

    const guard = await this.checkLoopGuard(instagramUserId, sender.id, recipient.id, message);
    if (guard === 'skip') return undefined;
    if (guard === 'notice') return InstagramService.LOOP_NOTICE;

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
    const token = accessTokens?.[instagramUserId];
    // if (!token) {
    //   this.logger.warn(`No Instagram access token found for instagramUserId: ${instagramUserId}`);
    //   return undefined;
    // }

    return token;
  }

  private async checkLoopGuard(
    instagramUserId: string,
    senderId: string,
    recipientId: string,
    message: { text?: string; is_echo?: boolean },
  ): Promise<'skip' | 'notice' | 'allow'> {
    // Echoes are outgoing events, not new requests from a manager.
    // The exact notice is a terminal message, even with a different recipient-side mid.
    if (message.is_echo === true || instagramUserId === senderId || message.text === InstagramService.LOOP_NOTICE) {
      this.logger.debug('Instagram loop guard: echo, own event or service notice skipped');
      return 'skip';
    }

    const accounts = {
      ...INSTAGRAM_MANAGED_ACCOUNTS,
      ...this.configService.get<Record<string, string>>('services.instagram.managedAccounts'),
    };
    const accessTokens = this.configService.get<Record<string, string>>('services.instagram.accessTokens') ?? {};
    if (senderId === recipientId || senderId in accounts || senderId in accessTokens) {
      this.logger.debug('Instagram loop guard: managed account blocked');
      return 'notice';
    }

    // A recipient-side sender.id is scoped; it cannot be compared directly with
    // the professional account IDs above. Resolve its username with this inbox's token.
    const accessToken = this.getInstagramAccessTokenByUserId(instagramUserId);
    if (!accessToken) {
      this.logger.warn('Instagram loop guard: no token for sender identity check; skipping');
      return 'skip';
    }

    try {
      const response = await lastValueFrom(this.httpService.get(
        `https://graph.instagram.com/v23.0/${senderId}`,
        {
          params: { fields: 'username' },
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        },
      ));
      const username = response.data?.username;
      if (typeof username !== 'string' || !username.trim()) {
        this.logger.warn('Instagram loop guard: missing sender username; skipping');
        return 'skip';
      }
      const isManaged = Object.values(accounts).some(
        (name) => name.toLowerCase() === username.toLowerCase(),
      );
      if (isManaged) this.logger.debug('Instagram loop guard: managed scoped sender blocked');

      return isManaged ? 'notice' : 'allow';
    } catch (error: any) {
      // Never fall through to AI if the sender could be one of our bots.
      // Do not log Axios errors here: they can contain Authorization headers.
      const statusCode = error?.response?.status;
      if (statusCode === 401 || error?.response?.data?.error?.code === 190) {
        await this.developerAlertService.notifyInstagramAuthFailure({
          instagramUserId,
          igId: recipientId,
          userId: senderId,
          statusCode,
          errorPayload: error?.response?.data,
        });
      }
      this.logger.warn('Instagram loop guard: sender profile lookup failed; skipping');
      return 'skip';
    }
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
