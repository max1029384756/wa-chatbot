import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageHistory } from './message-history.entity';

@Injectable()
export class MessageHistoryService {
  constructor(
    @InjectRepository(MessageHistory)
    private readonly repo: Repository<MessageHistory>,
  ) {}

  async save(data: Partial<MessageHistory>): Promise<MessageHistory> {
    const record = this.repo.create(data);
    return this.repo.save(record);
  }
}
