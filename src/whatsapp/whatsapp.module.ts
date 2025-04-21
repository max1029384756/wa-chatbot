import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp/whatsapp.controller';
import { WhatsappService } from './whatsapp/whatsapp.service';
import { AiService } from 'src/ai/ai.service';
import { UserContextService } from '../user-context/user-context.service';
import { StabilityaiService } from '../stabilityai/stabilityai.service';
import { AudioService } from '../audio/audio.service';

@Module({
  controllers: [WhatsappController],
  providers: [AiService, WhatsappService, UserContextService, StabilityaiService, AudioService],
})
export class WhatsappModule {}
