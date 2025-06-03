export interface IIncomingMessage {
  from: string;
  id: string;
  text: {
    body: string;
  };
  timestamp: string;
  type: string;
}
