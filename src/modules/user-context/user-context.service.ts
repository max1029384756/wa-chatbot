import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
// import * as crypto from 'crypto';
import { ContextMessage, ManagerStateData } from 'src/modules/user-context/interfaces';
import { MessageContent } from '@langchain/core/messages';

@Injectable()
export class UserContextService {
  private readonly redis: Redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
  });
  private readonly logger: Logger = new Logger(UserContextService.name);
  private readonly salt = process.env.HASHING_SALT;
  private readonly contextExpirationTime = 10800; // Expiration Time In Seconds

  // Phone Numbers shouldn't be said as plain text values
  // in the DB
  private hashPhoneNumber(phoneNumber: string) {
    // TODO: uncomment this for production
    // const hashedPhoneNumber = crypto.createHmac('sha256', this.salt).update(phoneNumber).digest('hex');
    // return hashedPhoneNumber;
    return phoneNumber;
  }

  private getManagerCallStateKey(wabaId: string, userId: string): string {
    return `managerCallState:${wabaId}:${userId}`;
  }

  public getClient() {
    return this.redis;
  }

  async saveToContext(context: MessageContent, contextType: 'user' | 'assistant', userID: string) {
    try {
      const value = JSON.stringify({
        role: contextType,
        content: context,
      });
      const hashedUserID = this.hashPhoneNumber(userID);
      await this.redis.rpush(hashedUserID, value);
      await this.redis.expire(hashedUserID, this.contextExpirationTime);

      return 'Context Saved!';
    } catch (error) {
      this.logger.error('Error Saving Context', error);
      return 'Error Saving Context';
    }
  }

  async saveAndFetchContext(
    context: string,
    contextType: 'user' | 'assistant',
    userID: string,
  ): Promise<ContextMessage[]> {
    try {
      const pipeline = this.redis.pipeline();
      const value = JSON.stringify({
        role: contextType,
        content: context,
      });
      const hashedUserID = this.hashPhoneNumber(userID);

      // Add context saving to pipeline
      pipeline.rpush(hashedUserID, value);

      pipeline.lrange(hashedUserID, 0, -1);

      pipeline.expire(hashedUserID, this.contextExpirationTime);

      // Execute both operations in a single round-trip

      const results = await pipeline.exec();
      const conversationContext = results[1][1] as string[];

      return conversationContext.map((item) => JSON.parse(item));
    } catch (error) {
      this.logger.error('Error Saving Context And Retrieving', error);
      return [];
    }
  }

  async getConversationHistory(userID: string) {
    try {
      const hashedUserID = this.hashPhoneNumber(userID);
      const conversation = await this.redis.lrange(hashedUserID, 0, -1);

      await this.redis.expire(hashedUserID, this.contextExpirationTime);

      return conversation.map((item) => JSON.parse(item));
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  // TODO: для прода после дебага хешировать userId для круд операций
  public async getManagerCallState(wabaId: string, userId: string): Promise<ManagerStateData | null> {
    try {
      const data = await this.redis.get(this.getManagerCallStateKey(wabaId, userId));
      if (!data) {
        return null;
      }
      return JSON.parse(data);
    } catch (error) {
      this.logger.error('Ошибка получения данных:', error);
      return null;
    }
  }

  public async setManagerCallState(wabaId: string, userId: string, data: ManagerStateData): Promise<boolean> {
    try {
      const jsonData = JSON.stringify(data);

      // TODO: 3600 использовать как контанту или в конфиге
      await this.redis.set(this.getManagerCallStateKey(wabaId, userId), jsonData, 'EX', 3600);

      return true;
    } catch (error) {
      // TODO: добавить обработку ошибок редиса. вызывать манагера или др
      this.logger.error('Ошибка сохранения данных:', error);
      return false;
    }
  }

  public async deleteManagerStateData(wabaId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.redis.del(this.getManagerCallStateKey(wabaId, userId));

      return result === 1;
    } catch (error) {
      this.logger.error('Ошибка удаления данных:', error);
      return false;
    }
  }
}
