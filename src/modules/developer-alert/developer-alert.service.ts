import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { TelegramService } from '@/modules/telegram/telegram.service';

type TelegramAlertConfig = {
  chatId: string;
  deduplicationTtlMs: number;
};

export type InstagramAuthFailureAlert = {
  instagramUserId: string;
  igId: string;
  userId: string;
  statusCode?: number;
  errorPayload?: unknown;
};

@Injectable()
export class DeveloperAlertService {
  private readonly logger = new Logger(DeveloperAlertService.name);
  private readonly redis: Redis;
  private readonly redisKeyPrefix = 'developer-alert:dedup:';

  constructor(
    private readonly configService: ConfigService,
    private readonly telegramService: TelegramService,
  ) {
    const host = this.configService.get<string>('REDIS_HOST') ?? process.env.REDIS_HOST ?? 'localhost';
    const portValue = this.configService.get<number>('REDIS_PORT') ?? process.env.REDIS_PORT ?? 6379;
    const port = typeof portValue === 'number' ? portValue : Number(portValue);
    const password = this.configService.get<string>('REDIS_PASSWORD') ?? process.env.REDIS_PASSWORD;

    this.redis = new Redis({
      host,
      port,
      ...(password ? { password } : {}),
    });
  }

  async notifyInstagramAuthFailure(details: InstagramAuthFailureAlert): Promise<void> {
    const telegramConfig = this.getTelegramConfig();
    if (!telegramConfig) {
      return;
    }

    const { instagramUserId, igId, userId, statusCode, errorPayload } = details;

    const payloadSnippet = errorPayload ? this.truncate(JSON.stringify(errorPayload), 1500) : undefined;
    const messageLines = [
      '🚨 Instagram authorization failed',
      `instagramUserId: ${instagramUserId}`,
      `igId: ${igId}`,
      `recipientUserId: ${userId}`,
      statusCode ? `status: ${statusCode}` : undefined,
      payloadSnippet ? `payload: ${payloadSnippet}` : undefined,
      'Action: Refresh the Instagram token.',
    ].filter(Boolean);

    await this.sendTelegramMessage(messageLines.join('\n'), `instagram-auth-${instagramUserId}`, telegramConfig);
  }

  private getTelegramConfig(): TelegramAlertConfig | undefined {
    const config = this.configService.get<TelegramAlertConfig | undefined>('services.developerAlert.telegram');

    if (!config?.chatId) {
      this.logger.warn('Developer alert telegram configuration is missing chat id. Skipping alert.');
      return undefined;
    }

    return {
      chatId: config.chatId,
      deduplicationTtlMs: config.deduplicationTtlMs ?? 30 * 60 * 1000,
    };
  }

  private async sendTelegramMessage(
    text: string,
    deduplicationKey: string,
    config: TelegramAlertConfig,
  ): Promise<void> {
    if (!text.trim()) {
      return;
    }

    if (deduplicationKey && !(await this.acquireDeduplicationSlot(deduplicationKey, config.deduplicationTtlMs))) {
      this.logger.debug(`Alert skipped due to deduplication window: ${deduplicationKey}`);
      return;
    }

    try {
      await this.telegramService.sendMessage(config.chatId, text);
      this.logger.log('Developer alert sent via Telegram');
    } catch (error) {
      this.logger.error('Failed to send developer alert via Telegram', error);
    }
  }

  private async acquireDeduplicationSlot(key: string, ttlMs: number): Promise<boolean> {
    if (!key) {
      return true;
    }

    const redisKey = `${this.redisKeyPrefix}${key}`;

    try {
      const result = await this.redis.set(redisKey, '1', 'PX', ttlMs, 'NX');

      if (result === null) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to access redis for developer alert deduplication', error);
      // Fail-open so that alerts still go out if Redis is unavailable.
      return true;
    }
  }

  private truncate(text: string, limit: number): string {
    if (text.length <= limit) {
      return text;
    }

    return `${text.slice(0, limit - 1)}…`;
  }
}
