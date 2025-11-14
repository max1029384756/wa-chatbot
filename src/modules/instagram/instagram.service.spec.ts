import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { InstagramService } from './instagram.service';
import { AiService } from '@/modules/ai/ai.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { MessageHistoryService } from '@/modules/message-history/message-history.service';
import { InstagramObject } from '@/modules/instagram/interfaces/instagram.object.interface';
import { PROVIDERS } from '@/modules/message-history/providers.constants';
import { of, throwError } from 'rxjs';

describe('InstagramService', () => {
  let service: InstagramService;
  let aiService: any;
  let configService: any;
  let httpService: any;
  let messageHistoryService: any;
  let developerAlertService: any;

  const buildPayload = (overrides: Partial<InstagramObject['entry'][0]['messaging'][0]>): InstagramObject => ({
    object: 'instagram',
    entry: [
      {
        id: 'entry-id',
        time: 0,
        messaging: [
          {
            sender: { id: 'sender-id' },
            recipient: { id: 'recipient-id' },
            timestamp: 0,
            message: { mid: 'mid', text: 'hello' },
            ...overrides,
          },
        ],
      },
    ],
  });

  beforeEach(() => {
    aiService = { generateAIResponse: jest.fn() };
    configService = { get: jest.fn() };
    httpService = { post: jest.fn() };
    messageHistoryService = { save: jest.fn() };
    developerAlertService = { notifyInstagramAuthFailure: jest.fn() };

    service = new InstagramService(
      aiService as unknown as AiService,
      configService as unknown as ConfigService,
      httpService as unknown as HttpService,
      messageHistoryService as unknown as MessageHistoryService,
      developerAlertService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleTestWebhook', () => {
    it('returns undefined when message is missing text', async () => {
      const payload = buildPayload({
        message: { mid: 'mid-without-text' },
      });

      const result = await service.handleTestWebhook(payload);

      expect(result).toBeUndefined();
      expect(aiService.generateAIResponse).not.toHaveBeenCalled();
      expect(messageHistoryService.save).not.toHaveBeenCalled();
    });

    it('returns a heart when payload is a story reaction', async () => {
      const payload = buildPayload({
        message: {
          mid: 'mid',
          text: '❤️',
          reply_to: {
            story: { id: 'story-id' },
          },
        },
      });

      const response = await service.handleTestWebhook(payload);

      expect(response).toBe('❤️');
      expect(aiService.generateAIResponse).not.toHaveBeenCalled();
      expect(messageHistoryService.save).not.toHaveBeenCalled();
    });

    it('returns AI response and stores message history for valid text payloads', async () => {
      const timestamp = 1700000000000;
      const payload = buildPayload({
        timestamp,
        message: {
          mid: 'mid',
          text: 'Hi there',
        },
      });
      aiService.generateAIResponse.mockResolvedValue('AI says hi');
      messageHistoryService.save.mockResolvedValue(undefined);

      const response = await service.handleTestWebhook(payload);

      expect(response).toBe('AI says hi');
      expect(aiService.generateAIResponse).toHaveBeenCalledWith('recipient-id', 'sender-id', 'Hi there');
      expect(messageHistoryService.save).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'sender-id',
          question: 'Hi there',
          answer: 'AI says hi',
          generationTime: expect.any(Number),
          date: new Date(timestamp),
          provider: PROVIDERS.INSTAGRAM,
        }),
      );
      const savedPayload = messageHistoryService.save.mock.calls[0][0];
      expect(savedPayload.generationTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('sendInstagramMessage', () => {
    const instagramUserId = 'inst-user';
    const igId = 'igId';
    const userId = 'userId';

    beforeEach(() => {
      configService.get.mockReturnValue({
        [instagramUserId]: 'token',
      });
    });

    it('sends a message successfully', async () => {
      httpService.post.mockReturnValue(of({ data: { success: true } }));

      await (service as any).sendInstagramMessage(instagramUserId, igId, userId, 'hello');

      expect(httpService.post).toHaveBeenCalledTimes(1);
      expect(developerAlertService.notifyInstagramAuthFailure).not.toHaveBeenCalled();
    });

    it('notifies developer on 401 errors', async () => {
      const axiosError = { response: { status: 401, data: { error: 'Unauthorized' } } };
      httpService.post.mockReturnValue(throwError(() => axiosError));

      await (service as any).sendInstagramMessage(instagramUserId, igId, userId, 'hello');

      expect(developerAlertService.notifyInstagramAuthFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          instagramUserId,
          igId,
          userId,
          statusCode: 401,
          errorPayload: axiosError.response.data,
        }),
      );
    });
  });
});
