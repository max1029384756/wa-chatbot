import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { FaissStore } from '@langchain/community/vectorstores/faiss';
import { OllamaEmbeddings } from '@langchain/ollama';
// import { BlobServiceClient } from '@azure/storage-blob';
import { faissStoreFolder, ollamaEmbeddingsModel } from '@/constants';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(private readonly configService: ConfigService) {}

  async parseAndSaveDocuments(dataFolder: string) {
    try {
      const files = await fs.readdir(dataFolder);

      for (const file of files) {
        if (path.extname(file).toLowerCase() === '.pdf') {
          console.log(`Processing file: ${file}`);
          // console.log(`Processing file: ${file.split('.')[0]}`);

          const filePath = path.join(dataFolder, file);

          // Load and parse the PDF
          const loader = new PDFLoader(filePath, { splitPages: false });
          const rawDocument = await loader.load();
          rawDocument[0].metadata.source = file;
          // rawDocument[0].metadata.business =
          //   this.configService.get<string>('businessContext')[file.split('.')[0]]?.name; // TODO проверить конфиг или лучше тесты сдделать

          // Split the text into smaller chunks
          const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 100,
          });
          const documents = await splitter.splitDocuments(rawDocument);

          // Generate embeddings and save in the database
          console.log('Using Ollama models and local DB');
          const embeddings = new OllamaEmbeddings({ model: ollamaEmbeddingsModel });

          const businessFaissStoreFolder = faissStoreFolder;
          const folderExists = await this.checkFolderExists(businessFaissStoreFolder);

          if (folderExists) {
            const store = await FaissStore.load(businessFaissStoreFolder, embeddings);
            await store.addDocuments(documents);
            await store.save(businessFaissStoreFolder);
          } else {
            const store = await FaissStore.fromDocuments(documents, embeddings, {});
            await store.save(businessFaissStoreFolder);
          }
        }
      }

      console.log('All documents processed successfully.');
    } catch (error) {
      console.error(`Error processing documents: ${error.message}`);
      throw new Error('Failed to process documents.');
    }
  }

  private async checkFolderExists(folderPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(folderPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }
}
