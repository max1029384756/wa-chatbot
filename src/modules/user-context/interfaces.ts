import { BaseMessage, MessageContent } from '@langchain/core/messages';

export interface ManagerStateData {
  managerCalled: boolean;
  lastUserMessageTime: string;
}

export interface ContextMessage extends BaseMessage {
  role: 'user' | 'assistant';
  content: MessageContent;
}

export interface ChatState {
  messages: ContextMessage[];
}
