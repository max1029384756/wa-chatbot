import { Module } from '@nestjs/common';
import { TelegramNotificationService } from './notification.service';

@Module({
  providers: [
    {
      provide: 'NotificationService',
      useClass: TelegramNotificationService,
    },
  ],
  exports: ['NotificationService'],
})
export class NotificationModule {}
