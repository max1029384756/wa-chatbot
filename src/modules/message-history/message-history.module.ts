import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageHistory } from './message-history.entity';
import { MessageHistoryService } from './message-history.service';

@Module({
  imports: [TypeOrmModule.forFeature([MessageHistory])],
  providers: [MessageHistoryService],
  exports: [MessageHistoryService],
})
export class MessageHistoryModule {}
