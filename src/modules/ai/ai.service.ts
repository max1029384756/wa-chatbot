import { Injectable, Logger } from '@nestjs/common';
import { UserContextService } from 'src/modules/user-context/user-context.service';
import { OllamaEmbeddings } from '@langchain/ollama';
import { ollamaEmbeddingsModel, faissStoreFolder, COMMANDS } from 'src/constants';
import { FaissStore } from '@langchain/community/vectorstores/faiss';
import { createStuffDocumentsChain } from 'langchain/chains/combine_documents';
import { ChatPromptTemplate, PromptTemplate } from '@langchain/core/prompts';
import { RunnableWithMessageHistory } from '@langchain/core/runnables';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ChatState } from 'src/modules/user-context/interfaces';
import { MessageContent } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';

import { RedisChatMessageHistory } from '@langchain/community/stores/message/ioredis';
import { Business, HumanRequest } from '@/modules/ai/interfaces';
import { ConfigService } from '@nestjs/config';

const TOPICS = {
  GENERAL_QUESTIONS: 'general_questions',
  VILLA_RESERVATIONS: 'villa_reservations',
  SPORTS_CLUB: 'sports_club',
  SURF_SCHOOL: 'surf_school',
};

@Injectable()
export class AiService {
  constructor(
    private readonly context: UserContextService,
    private readonly configService: ConfigService,
  ) {}

  // private readonly openai = new OpenAI({
  //   apiKey: process.env.OPENAI_API_KEY,
  // });
  private readonly logger = new Logger(AiService.name);
  private readonly questionCategoryToolName = 'get_question_category';
  private readonly model = new ChatOpenAI({
    model: 'gpt-4-turbo',
    temperature: 0.5, // 0 for no creativity
  }); /* new ChatOllama({
    temperature: 0, // 0 чтоб без креативности
    model: ollamaChatModel,
  }); */

  private readonly schemaForQuestionCategory = zodToJsonSchema(
    z.object({
      topic: z.enum([TOPICS.GENERAL_QUESTIONS, TOPICS.VILLA_RESERVATIONS, TOPICS.SPORTS_CLUB, TOPICS.SURF_SCHOOL]),
    }),
  );

  private readonly llmWithStructuredOutput = this.model.withStructuredOutput(this.schemaForQuestionCategory, {
    name: this.questionCategoryToolName,
  });

  private readonly llmForHumanRequest = this.model.withStructuredOutput(
    zodToJsonSchema(
      z.object({
        answer: z.enum([HumanRequest.TRUE, HumanRequest.FALSE]),
      }),
    ),
    {
      name: 'is_human_request',
    },
  );

  // Detect human requests (multilingual)
  public async isHumanRequest(input: string): Promise<boolean> {
    const intentPrompt = `
      Determine if the user's input contains a request to call or speak with a person, such as 'talk to someone', 'speak with', 'call manager', 'human', or 'person'. The input can be in any language.
      Input: "${input}"
    `;
    //Answer 'yes' or 'no'
    const intentResult = await this.llmForHumanRequest.invoke([{ role: 'system', content: intentPrompt }]);

    return intentResult.answer === HumanRequest.TRUE;
  }

  private getSupportContactInfo() {
    let response = 'For more information, please contact:\n';
    const contacts = this.configService.get<Business[]>('businessContext');

    contacts.forEach((contact) => {
      response += `${contact.name}: ${contact.phone}\n`;
    });

    return response.trim();
  }

  private systemPrompt(): string {
    //     return `You are an assistant of the Good Story company, representing the Good Story ${business.name} business. You help customers with questions and support requests. Your name is Goody. Be brief in your answers. Maintain a friendly, clear, and professional tone. Answer only plain text, DO NOT use Markdown.
    // Answer ONLY with information from the sources below and relevant to the ${business.name}. If there isn't enough information in the sources, say you don't know. Do not generate answers that don't use the sources. If asking a clarifying question to the user would help, ask the question.
    // If the user question is not in English, answer in the language used in the question.

    // SOURCES:
    // {context}`;
    //   }
    //     return `You are a helpful assistant of the Good Story company. You help customers with questions and support requests. Be brief in your answers. Maintain a friendly, clear, and professional tone. Answer only in plain text, DO NOT use Markdown.
    // Answer ONLY with information from the sources below and relevant to the Good Story company, do not generate answers that don't use the sources. If there isn't enough information in the sources, first try to clarify or rephrase the user's question to better understand their request. For example, ask: "Could you please clarify what you mean by [topic]?" or "Can you provide more details about [subject]?" Do this up to three times.
    // If after three clarifications you still cannot answer, say: "Sorry, I don't have that information after clarifying. ${this.getSupportContactInfo()}".
    // If the user question is not in English, answer in the language used in the question.

    // SOURCES:
    // {context}`;
    return `You are a helpful assistant of the Good Story company. You help customers with questions and support requests. Be brief in your answers. Maintain a friendly, clear, and professional tone. Answer only in plain text. DO NOT use Markdown.

Your answers must be based ONLY on the provided SOURCES. Do not generate answers from general knowledge or assumptions.

If a user question is unclear or unrelated to the Good Story company, ask a clarifying question to help understand their intent. You may ask up to three clarifying questions. Example clarifications: "Could you please clarify what you mean by [topic]?" or "Can you provide more details about [subject]?"

After three clarifying attempts, if you still cannot determine the intent or find relevant information in the SOURCES, respond with:
"Sorry, I don't have that information after clarifying. ${this.getSupportContactInfo()}"

If the user question is in another language, respond in that same language.

SOURCES:
{context}`;
  }
  // `You are a helpful assistant of the Good Story Village company. Use the provided chat history and context to answer the user's question accurately.
  // {context}`;

  public async generateAIResponse(waba: string, userId: string, userInput: string) {
    try {
      const sessionId = `${userId}:${waba}`; // second layer of object

      // If no environment variables are set, it means we are running locally
      const embeddings = new OllamaEmbeddings({ model: ollamaEmbeddingsModel });
      const store = await FaissStore.load(faissStoreFolder, embeddings);
      const chatHistory = new RedisChatMessageHistory({
        sessionId,
        sessionTTL: 900, // 15 min TODO: increase to 3600
        client: this.context.getClient(),
      });

      const ragChain = await createStuffDocumentsChain({
        llm: this.model,
        prompt: ChatPromptTemplate.fromMessages([
          ['system', this.systemPrompt()],
          ['placeholder', '{chat_history}'],
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

      // const similaritySearchWithScoreResults = await store.similaritySearchWithScore(userInput, 3);

      // for (const [doc, score] of similaritySearchWithScoreResults) {
      //   console.log(
      //     `\n\n\n*** [SIM=${score.toFixed(3)}] ${doc.pageContent}\n[${JSON.stringify(doc.metadata)}]\n===========`,
      //   );
      // }

      // context.forEach((doc) => console.log('doc.metadata.score: ', doc.metadata.score, doc));
      // Generate the response
      const response = await ragChainWithHistory.invoke(
        {
          input: userInput,
          context,
        },
        { configurable: { sessionId, userId } },
      );

      return response;
    } catch (error) {
      this.logger.error('Error generating AI response', error);

      return `Sorry, I am unable to process your request at the moment. ${this.getSupportContactInfo()}`;
    }
  }

  public callHuman() {
    return this.getSupportContactInfo();
  }

  public async answerQuestion(state: ChatState, topic: string, question: string): Promise<MessageContent> {
    const embeddings = new OllamaEmbeddings({ model: ollamaEmbeddingsModel });
    const vectorStore = await FaissStore.load(faissStoreFolder, embeddings);
    // const vectorStore = vectorStores[topic];
    const relevantDocs = await vectorStore.similaritySearch(question, 3);

    const SYSTEM_TEMPLATE = `You are a helpful assistant. Answer the question based on the following context:`;
    const context = relevantDocs.map((doc) => doc.pageContent).join('\n');

    // Include chat history in the prompt
    const chatHistory = state.messages.map((msg) => `${msg.role}: ${msg.content}`).join('\n');

    const response = await this.model.invoke([
      { role: 'system', content: SYSTEM_TEMPLATE },
      { role: 'user', content: `${chatHistory}\n\nContext: ${context}\n\nQuestion: ${question}` },
    ]);

    return response.content;
  }

  public async routeQuestion(state: ChatState, question: string): Promise<string> {
    const CATEGORIZATION_SYSTEM_TEMPLATE = `You are an expert customer support routing system.
    Your job is to detect the topic of a user's question based on the following categories:
    - Common Questions
    - Villa Reservations
    - Sports Club
    - Surf School
    
    Respond with a JSON object containing a single key called "topic" with one of the following values:
    "${TOPICS.GENERAL_QUESTIONS}", "${TOPICS.VILLA_RESERVATIONS}", "${TOPICS.SPORTS_CLUB}", "${TOPICS.SURF_SCHOOL}".
    Ensure you use the '${this.questionCategoryToolName}' tool`;

    const categorizationResponse = await this.llmWithStructuredOutput.invoke(
      [
        { role: 'system', content: CATEGORIZATION_SYSTEM_TEMPLATE },
        ...state.messages,
        { role: 'user', content: `Question: ${question}` },
      ],
      // {
      //   response_format: {
      //     type: 'json_object',
      //     schema: zodToJsonSchema(
      //       z.object({
      //         topic: z.enum([
      //           TOPICS.GENERAL_QUESTIONS,
      //           TOPICS.VILLA_RESERVATIONS,
      //           TOPICS.SPORTS_CLUB,
      //           TOPICS.SURF_SCHOOL,
      //         ]),
      //       }),
      //     ),
      //   },
      // },
    );

    console.log('categorizationResponse: ', categorizationResponse);

    // const categorizationOutput = JSON.parse(categorizationResponse.topic) as Record<string, string>;
    return categorizationResponse.topic || TOPICS.GENERAL_QUESTIONS;
  }
}
