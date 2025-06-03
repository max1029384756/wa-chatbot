import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { catchError, lastValueFrom, map } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { AiService } from '@/modules/ai/ai.service';
import axios, { AxiosRequestConfig } from 'axios';
import * as path from 'path';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { UserContextService } from 'src/modules/user-context/user-context.service';
import { ConfigService } from '@nestjs/config';
import { COMMANDS } from '@/constants';
import { NotificationService } from '@/modules/notifications/interfaces/notification.interface';
import { IIncomingMessage } from '@/modules/whatsapp/whatsapp/interfaces/incoming-message.interface';
// import gupshup from '@api/gupshup';

@Injectable()
export class WhatsappService {
  constructor(
    private readonly aiService: AiService,
    private readonly userContext: UserContextService,
    private readonly configService: ConfigService,
    @Inject('NotificationService') private readonly notificationService: NotificationService,
  ) { }

  private readonly httpService = new HttpService();
  private readonly logger = new Logger(WhatsappService.name);
  private readonly url = `https://graph.facebook.com/${process.env.WHATSAPP_CLOUD_API_VERSION}/${process.env.WHATSAPP_CLOUD_API_PHONE_NUMBER_ID}/messages`;
  private readonly config = {
    // headers: {
    //   'Content-Type': 'application/json',
    //   Authorization: `Bearer ${process.env.WHATSAPP_CLOUD_API_ACCESS_TOKEN}`,
    // },
    headers: {
      // 'Content-Type': 'application/x-www-form-urlencoded',
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
    await this.notificationService.sendNotification({
      chatId: this.configService.get<string>('businessContext')[wabaId].tgNotificationNubmer,
      userId,
      message: question,
    });
    this.logger.debug(`Manager has been notified for ${wabaId} user:${userId}. Question: ${question}`);

    const response = `I have called a manager, please wait for their response.`; // TODO возможно нужно попросить позвонить Please wait or call ${this.configService.get<string>('businessContext')[wabaId].phone}`;

    return this.sendTextMessage(userId, response, messageId);
  }

  async handleTextMessage(message: IIncomingMessage) {
    const messageSenderId = message.from;
    const messageText = message.text.body;
    const messageId = message.id;
    const source = process.env.GUPSHUP_SOURCE_NUMBER;

    this.logger.log(`userId: ${messageSenderId}, waba: ${source}`, messageText);

    // const isManagerCalled = await this.isManagerCalled(wabaId, userId);

    // if (isManagerCalled) {
    //   const response =
    //     'I see you’re still waiting—don’t worry, your request is queued! For faster help, you can call this number to speak directly'; // TODO: нужно ли здесь чтото отвечать 'A manager is currently assisting you. Please wait.';

    //   return this.sendTextMessage(userId, response, messageId);
    // }

    if (messageText.includes(COMMANDS.CALL_HUMAN)) {
      // return 'ok'
      return await this.callManager(source, messageSenderId, messageText, messageId);
    }

    if (await this.aiService.isHumanRequest(messageText)) {
      // TODO доавить кнопку с командой COMMANDS.CALL_HUMAN
      // или проверить возможность добавления команд в вабу
      const response = `To connect with a human, please enter the command ${COMMANDS.CALL_HUMAN}.`;

      return this.sendTextMessage(messageSenderId, response, messageId);
    }

    const aiResponse = await this.aiService.generateAIResponse(source, messageSenderId, messageText);

    /*  старый код с определением темы 
    const chatHistory = await this.userContext.saveAndFetchContext(messageText, 'user', messageSenderId);
    // Create state with chat history
    const state = { messages: chatHistory };

    // Determine the topic
    const topic = await this.aiService.routeQuestion(state, messageText);

    // Generate an answer
    const aiResponse = await this.aiService.answerQuestion(state, topic, messageText);

    this.userContext.saveToContext(aiResponse, 'assistant', messageSenderId);

    // Add the assistant's response to the chat history
    // chatHistory.push({ role: "assistant", content: answer });
    // await chatHistoryStore.set(messageSenderId, chatHistory);
    console.log('aiResponse: ', aiResponse); */

    return this.sendTextMessage(messageSenderId, aiResponse, messageId);
  }

  private async sendTextMessage(to: string, text: string, messageId: string) {
    // const aiResponse = await this.aiService.generateAIResponse(waba, to, userInput);
    // const aiResponse2 = await this.aiService.generateAIResponse2(waba, to, userInput);

    console.log('aiResponse: ', text);
    // return aiResponse;
    // console.log('aiResponse2: ', aiResponse2);

    // const data = JSON.stringify({
    //   messaging_product: 'whatsapp',
    //   recipient_type: 'individual',
    //   to: '789226360023', //'789037087268', //'789226360023', //to, //
    //   context: {
    //     message_id: messageId,
    //   },
    //   type: 'text',
    //   text: {
    //     preview_url: false,
    //     body: text,
    //   },
    // });

    // const data = JSON.stringify({
    //   channel: 'whatsapp',
    //   source: '79693007325',
    //   destination: '79226360023',
    //   message: {
    //     type: 'text',
    //     text: 'hii there',
    //     previewUrl: false,
    //   },
    // });

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

      console.log('data: ', data);


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

        const messageStatus = await lastValueFrom(response);
        this.logger.log('Message Marked As Read. Status:', messageStatus);
        // const response = await fetch(url, {
        //   method: 'POST',
        //   headers,
        //   body,
        // });

        // if (!response.ok) {
        //   throw new Error(`HTTP error! Status: ${response.status}`);
        // }

        // const result = await response.json();
        // console.log('Response:', result);
      } catch (error) {
        console.error('Error sending message:', error);
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
    // const data = JSON.stringify({
    //   messaging_product: 'whatsapp',
    //   status: 'read',
    //   message_id: messageId,
    //   typing_indicator: {
    //     type: 'text',
    //   },
    // });

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
      // this.logger.log('Message Marked As Read. Status:', messageStatus);
    } catch (error) {
      this.logger.error(error);
      return 'Axle broke!! Abort mission!!';
    }
  }
}
