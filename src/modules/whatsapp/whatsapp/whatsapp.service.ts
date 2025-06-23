import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { catchError, lastValueFrom, map } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { AiService } from '@/modules/ai/ai.service';
import axios, { AxiosRequestConfig } from 'axios';
import * as path from 'path';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { UserContextService } from 'src/modules/user-context/user-context.service';
import { ConfigService } from '@nestjs/config';
import { IWebhookHandler } from '@/modules/webhook/webhook-handler.interface';
import { COMMANDS } from '@/constants';
import { IIncomingMessage } from '@/modules/whatsapp/whatsapp/interfaces/incoming-message.interface';
import { MessageHistoryService } from '@/modules/message-history/message-history.service';
import { PROVIDERS } from '@/modules/message-history/providers.constants';
import { WhatsAppBusinessObject } from '@/modules/whatsapp/whatsapp/interfaces/waba.entry.object.interface';

@Injectable()
export class WhatsappService implements IWebhookHandler {
  constructor(
    private readonly aiService: AiService,
    private readonly userContext: UserContextService,
    private readonly configService: ConfigService,
    private readonly messageHistoryService: MessageHistoryService, // Injected service
  ) {}

  private readonly httpService = new HttpService();
  private readonly logger = new Logger(WhatsappService.name);
  private readonly url = `https://graph.facebook.com/${process.env.WHATSAPP_CLOUD_API_VERSION}/${process.env.WHATSAPP_CLOUD_API_PHONE_NUMBER_ID}/messages`;
  private readonly config = {
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.GUPSHUP_API_KEY,
    },
  };
  private readonly ONE_HOUR_IN_MINUTES = 60;

  private async isManagerCalled(wabaId: string, userId: string): Promise<boolean> {
    const userState = await this.userContext.getManagerCallState(wabaId, userId);

    if (userState) {
      const { managerCalled, lastUserMessageTime } = userState;

      if (managerCalled && lastUserMessageTime) {
        const now = new Date();
        const lastMessageTime = new Date(lastUserMessageTime);
        const timeDifference = (now.getTime() - lastMessageTime.getTime()) / (1000 * 60);

        if (timeDifference > this.ONE_HOUR_IN_MINUTES) {
          await this.userContext.deleteManagerStateData(wabaId, userId);
          // TODO: возможно нужно поставить тру для флага. проверить это
          this.logger.debug(`Manager call timeout for user ${userId}. Resuming bot functionality.`);

          return false;
        }

        return true;
      }
    }

    return false;
  }

  private async callManager(wabaId: string, userId: string, question: string, messageId: string) {
    const timestamp = new Date().toISOString();
    const state = { managerCalled: true, lastUserMessageTime: timestamp };

    await this.userContext.setManagerCallState(wabaId, userId, state);

    // TODO: exec notification to manager
    // await this.notificationService.sendNotification({
    //   chatId: this.configService.get<string>('businessContext')[wabaId].tgNotificationNubmer,
    //   userId,
    //   message: question,
    // });
    this.logger.debug(`Manager has been notified for ${wabaId} user:${userId}. Question: ${question}`);

    const response = `I have called a manager, please wait for their response.`; // TODO возможно нужно попросить позвонить Please wait or call ${this.configService.get<string>('businessContext')[wabaId].phone}`;

    return this.sendTextMessage(userId, response, messageId);
  }

  async handleInstMessage(request) {
    // this.logger.debug('incoming inst message', { sender, recipient, message, timestamp });
    const { id: userIgId } = request.entry?.[0];
    const { sender, recipient, message, timestamp } = request.entry?.[0]?.messaging[0];

    if (userIgId === sender.id) {
      this.logger.debug('Received message from the same user ID, ignoring message');
      return;
    }
    // сообщение от 6plwlugheam4 и отправитель я мой макскор акк
    // if (userIgId !== '17841475555245128' && sender.id !== '1089141306401636') {
    //   this.logger.debug('Not me inst message, ignoring message');
    //   return;
    // }

    // TODO: Validating Payloads https://developers.facebook.com/docs/instagram-platform/webhooks
    const aiResponse = await this.aiService.generateAIResponse(recipient.id, sender.id, message.text);

    const igId = recipient.id; //this.configService.get('INSTAGRAM_IG_ID');

    const accessToken = this.getInstagramAccessTokenByUserId(userIgId);
    if (!accessToken) {
      this.logger.error(`No access token found for userIgId: ${userIgId}`);
      return;
    }

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

  async handleTextMessage(message: IIncomingMessage) {
    const messageSenderId = message.from;
    const messageText = message.text.body;
    const messageId = message.id;
    const source = process.env.GUPSHUP_SOURCE_NUMBER;
    const timestamp = message.timestamp;

    this.logger.log(`userId: ${messageSenderId}, waba: ${source}`, messageText);

    // const isManagerCalled = await this.isManagerCalled(wabaId, userId);

    // if (isManagerCalled) {
    //   const response =
    //     'I see you’re still waiting—don’t worry, your request is queued! For faster help, you can call this number to speak directly'; // TODO: нужно ли здесь чтото отвечать 'A manager is currently assisting you. Please wait.';

    //   return this.sendTextMessage(userId, response, messageId);
    // }

    // if (messageText.includes(COMMANDS.CALL_HUMAN)) {
    //   // return 'ok'
    //   return await this.callManager(source, messageSenderId, messageText, messageId);
    // }

    if (await this.aiService.isHumanRequest(messageText)) {
      // TODO доавить кнопку с командой COMMANDS.CALL_HUMAN
      // или проверить возможность добавления команд в вабу
      // const response = `To connect with a human, please enter the command ${COMMANDS.CALL_HUMAN}.`;
      const response = `You requested to be connected with a manager.\n${this.aiService.callHuman()}`;

      return this.sendTextMessage(messageSenderId, response, messageId);
    }

    const start = Date.now();
    const aiResponse = await this.aiService.generateAIResponse(source, messageSenderId, messageText);
    const end = Date.now();

    let date: Date | undefined = undefined;
    if (timestamp) {
      const ms = Number(timestamp) * 1000;
      date = new Date(ms);
    }
    await this.messageHistoryService.save({
      clientId: messageSenderId,
      question: messageText,
      answer: aiResponse,
      generationTime: (end - start) / 1000,
      ...(date && { date }),
      provider: PROVIDERS.WHATSAPP,
    });

    return this.sendTextMessage(messageSenderId, aiResponse, messageId);
  }

  async handleTestTextMessage(message: IIncomingMessage) {
    const messageSenderId = message.from;
    const messageText = message.text.body;
    const timestamp = message.timestamp;
    const source = process.env.GUPSHUP_SOURCE_NUMBER;

    const start = Date.now();
    const aiResponse = await this.aiService.generateAIResponse(source, messageSenderId, messageText);
    const end = Date.now();

    let date: Date | undefined = undefined;
    if (timestamp) {
      const ms = Number(timestamp) * 1000;
      date = new Date(ms);
    }
    await this.messageHistoryService.save({
      clientId: messageSenderId,
      question: messageText,
      answer: aiResponse,
      generationTime: (end - start) / 1000,
      ...(date && { date }),
      provider: PROVIDERS.WHATSAPP,
    });

    this.logger.log('aiResponse: ', aiResponse);

    return aiResponse;
  }

  public async handleTestWebhook(payload: WhatsAppBusinessObject) {
    this.logger.debug('Received payload:', payload);
    const { messages } = payload?.entry?.[0]?.changes?.[0].value ?? {};

    if (!messages) return 'ok';

    const message = messages[0];
    const messageSenderId = message.from;
    const messageText = message.text.body;
    const timestamp = message.timestamp;
    const source = process.env.GUPSHUP_SOURCE_NUMBER;

    const start = Date.now();
    const aiResponse = await this.aiService.generateAIResponse(source, messageSenderId, messageText);
    const end = Date.now();

    let date: Date | undefined = undefined;
    if (timestamp) {
      const ms = Number(timestamp) * 1000;
      date = new Date(ms);
    }
    await this.messageHistoryService.save({
      clientId: messageSenderId,
      question: messageText,
      answer: aiResponse,
      generationTime: (end - start) / 1000,
      ...(date && { date }),
      provider: PROVIDERS.WHATSAPP,
    });

    this.logger.log('aiResponse: ', aiResponse);

    return aiResponse;
  }

  private async sendTextMessage(to: string, text: string, messageId: string) {
    this.logger.log('aiResponse: ', text);
    // return text;

    try {
      const url = 'https://api.gupshup.io/wa/api/v1/msg';

      const headers = {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
        apikey: process.env.GUPSHUP_API_KEY,
      };

      const data = new URLSearchParams({
        channel: 'whatsapp',
        source: process.env.GUPSHUP_SOURCE_NUMBER,
        destination: to,
        message: JSON.stringify({
          context: { msgId: messageId },
          type: 'text',
          text,
          previewUrl: true,
        }),
        'src.name': process.env.GUPSHUP_APP_NAME,
      });

      // console.log('data: ', data);

      try {
        const response = this.httpService
          .request({
            url,
            method: 'POST',
            headers,
            data,
          })
          .pipe(
            map((res) => {
              // this.logger.log('Response:', res.data);
              return res.data;
            }),
          )
          .pipe(
            catchError((error) => {
              this.logger.error(error);
              throw new BadRequestException('Error sending message to WhatsApp Cloud API');
            }),
          );

        const messageStatus = await lastValueFrom(response);
        this.logger.log('Message Sent. Status:', messageStatus);
      } catch (error) {
        this.logger.error('Error sending message:', error);
      }

      // const messageSendingStatus = await lastValueFrom(resp);
      // this.logger.log('Message Sent. Status:', messageSendingStatus);
    } catch (error) {
      this.logger.error(error);
      return 'Axle broke!! Abort mission!!';
    }
  }

  async getMediaUrl(mediaID: string): Promise<{ status: 'error' | 'success'; data: string }> {
    const url = `https://graph.facebook.com/${process.env.WHATSAPP_CLOUD_API_VERSION}/${mediaID}`;
    try {
      const response = await axios.get(url, this.config);
      return { status: 'success', data: response.data.url };
    } catch (e) {
      this.logger.error('Error fetching url', e);
      return { status: 'error', data: 'Error fetching Media Url' };
    }
  }

  async downloadMedia(fileID: string) {
    const config: AxiosRequestConfig = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.WHATSAPP_CLOUD_API_ACCESS_TOKEN}`,
      },
      responseType: 'arraybuffer',
    };

    try {
      const url = await this.getMediaUrl(fileID);
      this.logger.log('Our url', url);
      if (url.status === 'error') {
        throw new Error('Failed to get media url');
      }
      const response = await axios.get(url.data, config);

      const fileType = response?.headers['content-type'];
      const fileExtension = fileType?.split('/')[1];

      const fileName = `${fileID}.${fileExtension}`;

      const folderName = process.env.AUDIO_FILES_FOLDER;

      const folderPath = path.join(process.cwd(), folderName);
      const filePath = path.join(folderPath, fileName);

      //check if the audio folder exists, if not create
      if (!existsSync(folderPath)) {
        mkdirSync(folderPath);
      }

      writeFileSync(filePath, response.data);
      return { status: 'success', data: filePath };
    } catch (e) {
      this.logger.error('Error fetching url', e);
      return { status: 'error', data: 'Error fetching Media Url' };
    }
  }

  async sendImageByUrl(messageSender: string, fileName: string, messageId: string) {
    const imageUrl = `${process.env.SERVER_URL}/${fileName}`;
    const data = JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: messageSender,
      context: {
        message_id: messageId,
      },
      type: 'image',
      image: {
        link: imageUrl,
      },
    });

    try {
      const response = this.httpService
        .post(this.url, data, this.config)
        .pipe(
          map((res) => {
            return res.data;
          }),
        )
        .pipe(
          catchError((error) => {
            this.logger.error(error);
            throw new BadRequestException('Error Posting To WhatsApp Cloud API');
          }),
        );

      const messageSendingStatus = await lastValueFrom(response);

      return `Image sent successfully, response: ${messageSendingStatus}`;
    } catch (error) {
      this.logger.error(error);
      return 'Axle broke!! Error Sending Image!!';
    }
  }

  async sendAudioByUrl(messageSender: string, fileName: string) {
    const audioUrl = `${process.env.SERVER_URL}/${fileName}`;
    const data = JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: messageSender,
      type: 'audio',
      audio: {
        link: audioUrl,
      },
    });

    try {
      const response = this.httpService
        .post(this.url, data, this.config)
        .pipe(
          map((res) => {
            return res.data;
          }),
        )
        .pipe(
          catchError((error) => {
            this.logger.error(error);
            throw new BadRequestException('Error Posting To WhatsApp Cloud API');
          }),
        );

      const messageSendingStatus = await lastValueFrom(response);

      return `Audio sent successfully, response: ${messageSendingStatus}`;
    } catch (error) {
      this.logger.error(error);
      return 'Axle broke!! Error Sending Audio!!';
    }
  }
  async markMessageAsRead(messageId: string) {
    try {
      const response = this.httpService
        .request({
          url: `https://api.gupshup.io/wa/app/${process.env.GUPSHUP_APP_ID}/msg/${messageId}/read`,
          method: 'PUT',
          headers: this.config.headers,
        })
        .pipe(
          map((res) => {
            this.logger.log('Response:', res.data);
            return res.data;
          }),
        )
        .pipe(
          catchError((error) => {
            this.logger.error(error);
            throw new BadRequestException('Error Marking Message As Read');
          }),
        );

      // TODO: эта функция нужна для двух синих галочек прочитанности и печатания
      // понять что с ней делать
      const messageStatus = await lastValueFrom(response);
      this.logger.log('Message Marked As Read. Status:', messageStatus);
    } catch (error) {
      this.logger.error(error);
      return 'Axle broke!! Abort mission!!';
    }
  }

  /**
   * Returns the correct Instagram access token for a given userIgId using configService.
   * Assumes config structure: services.instagram.accessTokens = { [userIgId]: token }
   */
  private getInstagramAccessTokenByUserId(userIgId: string): string | undefined {
    const accessTokens = this.configService.get<Record<string, string>>('services.instagram.accessTokens');
    // if (!accessTokens) {
    //   this.logger.warn('No Instagram accessTokens found in config');
    //   return undefined;
    // }
    const token = accessTokens[userIgId];
    // if (!token) {
    //   this.logger.warn(`No Instagram access token found for userIgId: ${userIgId}`);
    //   return undefined;
    // }
    return token;
  }

  async handleWebhook(payload: WhatsAppBusinessObject): Promise<any> {
    this.logger.debug('Received payload:', payload);
    const { messages } = payload?.entry?.[0]?.changes?.[0].value ?? {};

    if (!messages) return 'ok';

    const message = messages[0];
    const messageSenderId = message.from;
    const messageText = message.text.body;
    const messageId = message.id;
    const source = process.env.GUPSHUP_SOURCE_NUMBER;
    const timestamp = message.timestamp;

    this.logger.log(`userId: ${messageSenderId}, waba: ${source}`, messageText);

    // const isManagerCalled = await this.isManagerCalled(wabaId, userId);

    // if (isManagerCalled) {
    //   const response =
    //     'I see you’re still waiting—don’t worry, your request is queued! For faster help, you can call this number to speak directly'; // TODO: нужно ли здесь чтото отвечать 'A manager is currently assisting you. Please wait.';

    //   return this.sendTextMessage(userId, response, messageId);
    // }

    // if (messageText.includes(COMMANDS.CALL_HUMAN)) {
    //   // return 'ok'
    //   return await this.callManager(source, messageSenderId, messageText, messageId);
    // }

    if (await this.aiService.isHumanRequest(messageText)) {
      // TODO доавить кнопку с командой COMMANDS.CALL_HUMAN
      // или проверить возможность добавления команд в вабу
      // const response = `To connect with a human, please enter the command ${COMMANDS.CALL_HUMAN}.`;
      const response = `You requested to be connected with a manager.\n${this.aiService.callHuman()}`;

      return this.sendTextMessage(messageSenderId, response, messageId);
    }

    const start = Date.now();
    const aiResponse = await this.aiService.generateAIResponse(source, messageSenderId, messageText);
    const end = Date.now();

    let date: Date | undefined = undefined;
    if (timestamp) {
      const ms = Number(timestamp) * 1000;
      date = new Date(ms);
    }
    await this.messageHistoryService.save({
      clientId: messageSenderId,
      question: messageText,
      answer: aiResponse,
      generationTime: (end - start) / 1000,
      ...(date && { date }),
      provider: PROVIDERS.WHATSAPP,
    });

    return this.sendTextMessage(messageSenderId, aiResponse, messageId);
  }
}
