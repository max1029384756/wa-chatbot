export interface IWebhookHandler {
  handleWebhook(payload: any): Promise<any>;
  handleTestWebhook?(payload: any): Promise<any>;
}
