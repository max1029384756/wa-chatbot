import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { configFactory } from '@/common/config/factory';
import { AppService } from './app.service';
import { WhatsappModule } from '@/modules/whatsapp/whatsapp.module';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from '@/modules/ai/ai.module';
import { UserContextModule } from '@/modules/user-context/user-context.module';
import { StabilityaiModule } from '@/modules/stabilityai/stabilityai.module';
import { AudioModule } from '@/modules/audio/audio.module';
import { CommandModule } from 'nestjs-command';
import { NotificationModule } from '@/modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configFactory],
      isGlobal: true,
      cache: false,
    }),
    WhatsappModule,
    AiModule,
    UserContextModule,
    StabilityaiModule,
    AudioModule,
    CommandModule,
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
