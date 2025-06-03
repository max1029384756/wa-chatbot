import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp/whatsapp.controller';
import { WhatsappService } from './whatsapp/whatsapp.service';
import { AiService } from '@/modules/ai/ai.service';
import { UserContextService } from '../user-context/user-context.service';
import { StabilityaiService } from '../stabilityai/stabilityai.service';
import { AudioService } from '../audio/audio.service';
import { UserContextModule } from 'src/modules/user-context/user-context.module';
import { NotificationModule } from '@/modules/notifications/notifications.module';
// import { NotificationService } from '@/modules/notifications/notification.service';

@Module({
  imports: [UserContextModule, NotificationModule],
  controllers: [WhatsappController],
  providers: [AiService, WhatsappService, UserContextService, StabilityaiService, AudioService],
})
export class WhatsappModule {}
