import { Injectable, Logger } from '@nestjs/common';
import { UserContextService } from 'src/user-context/user-context.service';
import { Embeddings } from '@langchain/core/embeddings';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { VectorStore } from '@langchain/core/vectorstores';
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { ollamaChatModel, ollamaEmbeddingsModel, faissStoreFolder } from 'src/constants';
import { FaissStore } from '@langchain/community/vectorstores/faiss';
import { FileSystemChatMessageHistory } from '@langchain/community/stores/message/file_system';
import { createStuffDocumentsChain } from 'langchain/chains/combine_documents';
import { ChatPromptTemplate, PromptTemplate } from '@langchain/core/prompts';
import { RunnableWithMessageHistory } from '@langchain/core/runnables';

@Injectable()
export class AiService {
  constructor(private readonly context: UserContextService) {}

  // private readonly openai = new OpenAI({
  //   apiKey: process.env.OPENAI_API_KEY,
  // });
  private readonly logger = new Logger(AiService.name);

  private readonly systemPrompt = `Assistant helps the Good Story Village company customers with questions and support requests. Be brief in your answers. Answer only plain text, DO NOT use Markdown.
Answer ONLY with information from the sources below. If there isn't enough information in the sources, say you don't know. Do not generate answers that don't use the sources. If asking a clarifying question to the user would help, ask the question.
If the user question is not in English, answer in the language used in the question.

Each source has the format "[filename]: information".

SOURCES:
{context}`;

  async generateAIResponse(userID: string, userInput: string) {
    const azureOpenAiEndpoint = process.env.AZURE_OPENAI_API_ENDPOINT;

    try {
      let embeddings: Embeddings;
      let model: BaseChatModel;
      let store: VectorStore;
      let chatHistory: FileSystemChatMessageHistory;

      // TODO правильно ли присваивать sessionId?
      const sessionId = userID; // Use userID as sessionId for simplicity
      this.logger.log(`userId: ${userID}, sessionId: ${sessionId}`, userInput);

      if (azureOpenAiEndpoint) {
        // const credentials = getCredentials();
        // const azureADTokenProvider = getAzureOpenAiTokenProvider();
        // // Initialize models and vector database
        // embeddings = new AzureOpenAIEmbeddings({ azureADTokenProvider });
        // model = new AzureChatOpenAI({
        //   temperature: 0.7,
        //   azureADTokenProvider,
        // });
        // store = new AzureCosmosDBNoSQLVectorStore(embeddings, { credentials });
        // // Initialize chat history
        // chatHistory = new AzureCosmsosDBNoSQLChatMessageHistory({
        //   sessionId,
        //   userId: userID,
        //   credentials,
        // });
      } else {
        // If no environment variables are set, it means we are running locally
        this.logger.log('No Azure OpenAI endpoint set, using Ollama models and local DB');
        embeddings = new OllamaEmbeddings({ model: ollamaEmbeddingsModel });
        model = new ChatOllama({
          temperature: 0.7,
          model: ollamaChatModel,
        });
        store = await FaissStore.load(faissStoreFolder, embeddings);

        chatHistory = new FileSystemChatMessageHistory({
          sessionId,
          userId: userID,
        });
      }

      // Create the chain that combines the prompt with the documents
      const ragChain = await createStuffDocumentsChain({
        llm: model,
        prompt: ChatPromptTemplate.fromMessages([
          ['system', this.systemPrompt],
          ['human', '{input}'],
        ]),
        documentPrompt: PromptTemplate.fromTemplate('[{source}]: {page_content}\n'),
      });

      // Handle chat history
      const ragChainWithHistory = new RunnableWithMessageHistory({
        runnable: ragChain,
        inputMessagesKey: 'input',
        historyMessagesKey: 'chat_history',
        getMessageHistory: async () => chatHistory,
      });

      // Retriever to search for the documents in the database
      const retriever = store.asRetriever(3);
      const context = await retriever.invoke(userInput);

      // Generate the response
      const response = await ragChainWithHistory.invoke(
        {
          input: userInput,
          context,
        },
        { configurable: { sessionId } },
      );

      // Save the response to the context
      this.context.saveToContext(response, 'assistant', userID);

      return response;
    } catch (error) {
      this.logger.error('Error generating AI response', error);

      return 'Sorry, I am unable to process your request at the moment.';
    }
  }
}
