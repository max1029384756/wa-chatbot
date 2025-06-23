// Основной интерфейс для всего объекта
export interface InstagramObject {
  object: string;
  entry: Entry[];
}

// Интерфейс для entry
export interface Entry {
  time: number;
  id: string;
  messaging: Message[];
}

// Интерфейс для messaging
export interface Message {
  sender: User;
  recipient: User;
  timestamp: number;
  message: MessageContent;
}

// Интерфейс для отправителя и получателя
export interface User {
  id: string;
}

// Интерфейс для содержимого сообщения
export interface MessageContent {
  mid: string;
  text: string;
}
