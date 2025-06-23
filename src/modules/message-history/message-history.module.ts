import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageHistory } from './message-history.entity';
import { MessageHistoryService } from './message-history.service';
import { Provider } from './provider.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MessageHistory, Provider])],
  providers: [MessageHistoryService],
  exports: [MessageHistoryService],
})
export class MessageHistoryModule {}
