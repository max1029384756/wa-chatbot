import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { InstagramService } from './instagram.service';
import { AiService } from '@/modules/ai/ai.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { MessageHistoryService } from '@/modules/message-history/message-history.service';
import { InstagramObject } from '@/modules/instagram/interfaces/instagram.object.interface';
import { PROVIDERS } from '@/modules/message-history/providers.constants';
import { of, throwError } from 'rxjs';
import { Logger } from '@nestjs/common';

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
    configService = { get: jest.fn((key: string) => {
      if (key === 'services.instagram.accessTokens') return { 'entry-id': 'token' };
      if (key === 'services.instagram.managedAccounts') return {
        '900000001': 'sample_lodge', '900000002': 'sample_waves',
        '900000003': 'sample_club', '900000004': 'sample_test',
      };
      return undefined;
    }) };
    httpService = { post: jest.fn(), get: jest.fn() };
    httpService.get.mockReturnValue(of({ data: { id: 'sender-id', username: 'customer' } }));
    httpService.post.mockReturnValue(of({ data: { message_id: 'sent-mid' } }));
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

  describe('loop protection', () => {
    it.each([undefined, {}, [], null, { abc: 'sample' }, { '900000001': '' }, { '900000001': '  ' }, { '900000001': 123 }])(
      'disables all automatic replies for invalid configuration %j', async (accounts) => {
        configService.get.mockImplementation((key: string) => key === 'services.instagram.managedAccounts' ? accounts : { 'entry-id': 'token' });
        const warning = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

        try {
          await service.handleWebhook(buildPayload({ sender: { id: 'recipient-id' } }));
          await service.handleWebhook(buildPayload({}));
          await service.handleTestWebhook(buildPayload({ message: { mid: 'reaction', text: '❤️' } }));

          expect(aiService.generateAIResponse).not.toHaveBeenCalled();
          expect(messageHistoryService.save).not.toHaveBeenCalled();
          expect(httpService.post).not.toHaveBeenCalled();
          expect(httpService.get).not.toHaveBeenCalled();
          expect(warning).toHaveBeenCalledWith(expect.stringContaining('INSTAGRAM_MANAGED_ACCOUNTS'));
        } finally {
          warning.mockRestore();
        }
      },
    );

    it('normalizes configured usernames and profile usernames', async () => {
      configService.get.mockImplementation((key: string) => key === 'services.instagram.managedAccounts'
        ? { '900000002': '  SAMPLE_WAVES  ' } : { 'entry-id': 'token' });
      httpService.get.mockReturnValue(of({ data: { username: ' sample_waves ' } }));

      await service.handleWebhook(buildPayload({}));

      expect(aiService.generateAIResponse).not.toHaveBeenCalled();
      expect(httpService.post.mock.calls[0][1].message.text).toContain('разработчику');
    });

    it('ignores echo even when the sender ID differs from entry ID', async () => {
      const payload = buildPayload({ message: { mid: 'echo', text: 'hello', is_echo: true } });

      await service.handleWebhook(payload);

      expect(aiService.generateAIResponse).not.toHaveBeenCalled();
      expect(httpService.post).not.toHaveBeenCalled();
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it.each(['sample_lodge', 'sample_waves', 'sample_club', 'sample_test'])(
      'sends a notice instead of AI for scoped sender belonging to %s', async (username) => {
        httpService.get.mockReturnValue(of({ data: { id: 'sender-id', username } }));

        await service.handleWebhook(buildPayload({}));

        expect(aiService.generateAIResponse).not.toHaveBeenCalled();
        expect(messageHistoryService.save).not.toHaveBeenCalled();
        expect(httpService.post).toHaveBeenCalledTimes(1);
        expect(httpService.post.mock.calls[0][1].message.text).toContain('разработчику');
      },
    );

    it('does not answer the notice received by the other account, including after restart', async () => {
      httpService.get.mockReturnValue(of({ data: { id: 'sender-id', username: 'sample_waves' } }));
      await service.handleWebhook(buildPayload({}));
      const notice = httpService.post.mock.calls[0][1].message.text;
      const restarted = new InstagramService(aiService, configService, httpService, messageHistoryService, developerAlertService);
      httpService.post.mockClear();

      await restarted.handleWebhook(buildPayload({ message: { mid: 'new-scoped-mid', text: notice } }));

      expect(httpService.post).not.toHaveBeenCalled();
      expect(aiService.generateAIResponse).not.toHaveBeenCalled();
    });

    it('skips AI if sender identity cannot be checked', async () => {
      httpService.get.mockReturnValue(throwError(() => new Error('profile unavailable')));

      await service.handleWebhook(buildPayload({}));

      expect(aiService.generateAIResponse).not.toHaveBeenCalled();
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it.each([{ status: 401, code: 0 }, { status: 400, code: 190 }])(
      'preserves developer authentication alerts on profile failure %j', async ({ status, code }) => {
        const errorPayload = { error: { code, message: 'Expired token' } };
        httpService.get.mockReturnValue(throwError(() => ({ response: { status, data: errorPayload } })));

        await service.handleWebhook(buildPayload({}));

        expect(developerAlertService.notifyInstagramAuthFailure).toHaveBeenCalledWith({
          instagramUserId: 'entry-id', igId: 'recipient-id', userId: 'sender-id',
          statusCode: status, errorPayload,
        });
        expect(aiService.generateAIResponse).not.toHaveBeenCalled();
        expect(httpService.post).not.toHaveBeenCalled();
      },
    );

    it('keeps normal customer responses', async () => {
      aiService.generateAIResponse.mockResolvedValue('customer answer');

      await service.handleWebhook(buildPayload({}));

      expect(aiService.generateAIResponse).toHaveBeenCalledTimes(1);
      expect(httpService.post.mock.calls[0][1].message.text).toBe('customer answer');
    });

    it('sends a notice for a non-echo self-message', async () => {
      await service.handleWebhook(buildPayload({ sender: { id: 'recipient-id' } }));

      expect(aiService.generateAIResponse).not.toHaveBeenCalled();
      expect(httpService.post).toHaveBeenCalledTimes(1);
    });

    it('retains the existing own-account event check when is_echo is absent', async () => {
      await service.handleWebhook(buildPayload({ sender: { id: 'entry-id' } }));

      expect(aiService.generateAIResponse).not.toHaveBeenCalled();
      expect(httpService.post).not.toHaveBeenCalled();
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('blocks a managed ID even without an active token for that sender', async () => {
      await service.handleWebhook(buildPayload({ sender: { id: '900000003' } }));

      expect(aiService.generateAIResponse).not.toHaveBeenCalled();
      expect(httpService.post).toHaveBeenCalledTimes(1);
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('blocks a managed story reaction before sending a heart', async () => {
      httpService.get.mockReturnValue(of({ data: { id: 'sender-id', username: 'Sample_Waves' } }));

      await service.handleWebhook(buildPayload({ message: { mid: 'reaction', text: '❤️', reply_to: { story: { id: 'story' } } } }));

      expect(httpService.post.mock.calls[0][1].message.text).toContain('разработчику');
      expect(aiService.generateAIResponse).not.toHaveBeenCalled();
      expect(httpService.get).toHaveBeenCalledWith('https://graph.instagram.com/v23.0/sender-id', {
        params: { fields: 'username' },
        headers: { Authorization: 'Bearer token' },
        timeout: 10000,
      });
    });

    it('does not process unknown identity if the inbox token is missing', async () => {
      configService.get.mockImplementation((key: string) => key === 'services.instagram.managedAccounts'
        ? { '900000001': 'sample_lodge' } : undefined);

      await service.handleWebhook(buildPayload({}));

      expect(aiService.generateAIResponse).not.toHaveBeenCalled();
      expect(httpService.post).not.toHaveBeenCalled();
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it.each([{}, { username: '' }, { username: 123 }])('skips malformed profile %j', async (data) => {
      httpService.get.mockReturnValue(of({ data }));

      await service.handleWebhook(buildPayload({}));

      expect(aiService.generateAIResponse).not.toHaveBeenCalled();
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('applies the same guard to the test handler', async () => {
      httpService.get.mockReturnValue(of({ data: { id: 'sender-id', username: 'sample_club' } }));

      const response = await service.handleTestWebhook(buildPayload({}));

      expect(response).toContain('разработчику');
      expect(aiService.generateAIResponse).not.toHaveBeenCalled();
      expect(httpService.post).not.toHaveBeenCalled();
    });
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
