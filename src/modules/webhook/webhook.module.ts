import { Module, Global } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { WhatsappService } from '@/modules/whatsapp/whatsapp/whatsapp.service';
import { InstagramService } from '@/modules/instagram/instagram.service';
import { TelegramService } from '@/modules/telegram/telegram.service';
import { AiService } from '@/modules/ai/ai.service';
import { UserContextService } from '@/modules/user-context/user-context.service';
import { ConfigService } from '@nestjs/config';
import { MessageHistoryModule } from '@/modules/message-history/message-history.module';
import { HttpModule } from '@nestjs/axios';
import { DeveloperAlertService } from '@/modules/developer-alert/developer-alert.service';

@Global()
@Module({
  imports: [MessageHistoryModule, HttpModule],
  controllers: [WebhookController],
  providers: [
    WebhookService,
    AiService,
    UserContextService,
    ConfigService,
    WhatsappService,
    InstagramService,
    TelegramService,
    DeveloperAlertService,
    {
      provide: 'WEBHOOK_HANDLERS',
      useFactory: (
        whatsappService: WhatsappService,
        instagramService: InstagramService,
        telegramService: TelegramService,
      ) => ({
        whatsapp: whatsappService,
        instagram: instagramService,
        telegram: telegramService,
      }),
      inject: [WhatsappService, InstagramService, TelegramService],
    },
  ],
  exports: [WebhookService],
})
export class WebhookModule {}
