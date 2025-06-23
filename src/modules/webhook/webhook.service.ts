import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { IWebhookHandler } from './webhook-handler.interface';

@Injectable()
export class WebhookService {
  constructor(
    @Inject('WEBHOOK_HANDLERS')
    private readonly handlers: Record<string, IWebhookHandler>,
  ) {}

  async handle(source: string, payload: any): Promise<any> {
    const handler = this.handlers[source];
    if (!handler) {
      throw new BadRequestException(`No handler registered for source: ${source}`);
    }
    return handler.handleWebhook(payload);
  }

  async handleTest(source: string, payload: any): Promise<any> {
    const handler = this.handlers[source];
    if (!handler) {
      throw new BadRequestException(`No test handler registered for source: ${source}`);
    }
    return handler.handleTestWebhook(payload);
  }
}
