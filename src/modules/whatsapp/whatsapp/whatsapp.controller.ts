import { Body, Controller, Get, HttpCode, Post, Req, Logger } from '@nestjs/common';
import { Request } from 'express';

import * as process from 'node:process';
import { WhatsappService } from './whatsapp.service';
import { AudioService } from '@/modules/audio/audio.service';
import { StabilityaiService } from 'src/modules/stabilityai/stabilityai.service';
import { AiService } from '@/modules/ai/ai.service';


@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    private readonly whatsAppService: WhatsappService,
    private readonly stabilityaiService: StabilityaiService,
    private readonly audioService: AudioService,
    private readonly aiService: AiService,
  ) {}

  @Get('webhook')
  whatsappVerificationChallenge(@Req() request: Request) {
    // this.logger.debug('Received messages:', JSON.stringify(request.query));
    const mode = request.query['hub.mode'];
    const challenge = request.query['hub.challenge'];
    const token = request.query['hub.verify_token'];

    const verificationToken = process.env.WHATSAPP_CLOUD_API_WEBHOOK_VERIFICATION_TOKEN;

    if (!mode || !token) {
      return 'Error verifying token';
    }

    if (mode === 'subscribe' && token === verificationToken) {
      return challenge?.toString();
    }
  }

  /*  messages
  [
  {
    "from": "79384021087",
    "id": "wamid.HBgLNzkzODQwMjEwODcVAgASGBQzQUYyRENEN0ZGQzQ2MTgwQ0IzRgA=",
    "text": {
      "body": "hi"
    },
    "timestamp": "1748611168",
    "type": "text"
  }
]
  */

  @Post('webhook')
  @HttpCode(200)
  async handleIncomingWhatsappMessage(@Body() request: any) {
    const { messages } = request?.entry?.[0]?.changes?.[0].value ?? {};
    this.logger.debug('Received request:', request);

    if (request?.object === 'instagram') {
      this.whatsAppService.handleInstMessage(request);
    }
    // this.logger.debug('Received messages:', messages);
    if (!messages) return 'ok';

    const message = messages[0];

    // TODO: remove async
    await this.whatsAppService.markMessageAsRead(message.id);

    switch (message.type) {
      case 'text':
        // const imageGenerationCommand = '/imagine';
        // if (text.toLowerCase().includes(imageGenerationCommand)) {
        //   const response = await this.stabilityaiService.textToImage(text.replaceAll(imageGenerationCommand, ''));

        //   if (Array.isArray(response)) {
        //     await this.whatsAppService.sendImageByUrl(messageSender, response[0], messageId);
        //   }
        //   return;
        // }
        // const wabaId = request?.entry?.[0].id;
        this.whatsAppService.handleTextMessage(message);
        // this.whatsAppService.sendTextMessage(wabaId, messageSenderId, msg, messageId);
        break;
      // case 'audio':
      //   const audioID = message.audio.id;
      //   const response = await this.whatsAppService.downloadMedia(audioID);
      //   if (response.status === 'error') {
      //     return;
      //   }

      //   const transcribedSpeech = await this.audioService.convertAudioToText(response.data);

      //   if (transcribedSpeech.status === 'error') {
      //     return;
      //   }

      //   const aiResponse = await this.aiService.generateAIResponse(messageSender, transcribedSpeech.data);

      //   const textToSpeech = await this.audioService.convertTextToSpeech(aiResponse);

      //   if (textToSpeech.status === 'error') {
      //     return;
      //   }

      //   await this.whatsAppService.sendAudioByUrl(messageSender, textToSpeech.data);
      default:
        this.logger.warn(`Unhandled message type: ${message.type}`);
        break;
    }

    return 'Message processed';
  }

  @Post('webhook/test')
  @HttpCode(200)
  test(@Body() request: any) {
    if (request.object === 'instagram') {
      const { sender, message, timestamp } = request.entry?.[0]?.messaging[0];
      return this.whatsAppService.handleTestTextMessage({
        from: sender.id,
        id: message.mid,
        text: {
          body: message.text,
        },
        timestamp,
        type: 'text',
      });
    }
    const { messages } = request?.entry?.[0]?.changes?.[0].value ?? {};
    this.logger.debug('Received test messages:', messages);
    if (!messages) return 'ok';

    const message = messages[0];

    switch (message.type) {
      case 'text':
        return this.whatsAppService.handleTestTextMessage(message);
    }

    return 'Message processed';
  }
}
