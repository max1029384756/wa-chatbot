import { Controller, Post, Body, Param, HttpCode, Get, Req } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { Request } from 'express';

@Controller('webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Get(':source')
  registration(@Req() request: Request) {
    const mode = request.query['hub.mode'];
    const challenge = request.query['hub.challenge'];
    const token = request.query['hub.verify_token'];

    const verificationToken = process.env.META_WEBHOOK_VERIFICATION_TOKEN;

    if (!mode || !token) {
      return 'Error verifying token';
    }

    if (mode === 'subscribe' && token === verificationToken) {
      return challenge?.toString();
    }
  }

  @Post(':source')
  @HttpCode(200)
  async handleWebhook(@Param('source') source: string, @Body() payload: any) {
    this.webhookService.handle(source, payload);
  }

  @Post('test/:source')
  @HttpCode(200)
  async handleTestWebhook(@Param('source') source: string, @Body() payload: any) {
    return this.webhookService.handleTest(source, payload);
  }
}
