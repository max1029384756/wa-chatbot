import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { configFactory } from '@/common/config/factory';
import { AppService } from './app.service';
import { WhatsappModule } from '@/modules/whatsapp/whatsapp.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AiModule } from '@/modules/ai/ai.module';
import { UserContextModule } from '@/modules/user-context/user-context.module';
import { StabilityaiModule } from '@/modules/stabilityai/stabilityai.module';
import { AudioModule } from '@/modules/audio/audio.module';
import { CommandModule } from 'nestjs-command';
import { NotificationModule } from '@/modules/notifications/notifications.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageHistoryModule } from '@/modules/message-history/message-history.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configFactory],
      isGlobal: true,
      cache: false,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('POSTGRES_HOST', 'localhost'),
        port: +configService.get('POSTGRES_PORT', 5432),
        username: configService.get('POSTGRES_USER', 'postgres'),
        password: configService.get('POSTGRES_PASSWORD', 'postgres'),
        database: configService.get('POSTGRES_DB', 'gs_wa_agent_db'),
        autoLoadEntities: true,
        synchronize: true,
      }),
      inject: [ConfigService],
    }),
    WhatsappModule,
    AiModule,
    UserContextModule,
    StabilityaiModule,
    AudioModule,
    CommandModule,
    NotificationModule,
    MessageHistoryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
