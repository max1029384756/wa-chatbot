import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { FaissStore } from '@langchain/community/vectorstores/faiss';
import { OllamaEmbeddings } from '@langchain/ollama';
// import { BlobServiceClient } from '@azure/storage-blob';
import { faissStoreFolder, ollamaEmbeddingsModel } from '../constants';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  async parseAndSaveDocuments(dataFolder: string) {
    const azureOpenAiEndpoint = process.env.AZURE_OPENAI_API_ENDPOINT;
    const storageUrl = process.env.AZURE_STORAGE_URL;
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;

    try {
      const files = await fs.readdir(dataFolder);

      for (const file of files) {
        if (path.extname(file).toLowerCase() === '.pdf') {
          this.logger.log(`Processing file: ${file}`);
          const filePath = path.join(dataFolder, file);

          // Load and parse the PDF
          const loader = new PDFLoader(filePath, { splitPages: false });
          const rawDocument = await loader.load();
          rawDocument[0].metadata.source = file;

          // Split the text into smaller chunks
          const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1500,
            chunkOverlap: 100,
          });
          const documents = await splitter.splitDocuments(rawDocument);

          // Generate embeddings and save in the database
          if (azureOpenAiEndpoint) {
            this.logger.error('Azure OpenAI endpoint is not implemented yet.');
          } else {
            this.logger.log('No Azure OpenAI endpoint set, using Ollama models and local DB');
            const embeddings = new OllamaEmbeddings({ model: ollamaEmbeddingsModel });
            const folderExists = await this.checkFolderExists(faissStoreFolder);

            if (folderExists) {
              const store = await FaissStore.load(faissStoreFolder, embeddings);
              await store.addDocuments(documents);
              await store.save(faissStoreFolder);
            } else {
              const store = await FaissStore.fromDocuments(documents, embeddings, {});
              await store.save(faissStoreFolder);
            }
          }

          // Upload the PDF file to Azure Blob Storage
          if (storageUrl && containerName) {
            // this.logger.log(`Uploading file to blob storage: "${containerName}/${file}"`);
            // const blobServiceClient = new BlobServiceClient(storageUrl);
            // const containerClient = blobServiceClient.getContainerClient(containerName);
            // const blockBlobClient = containerClient.getBlockBlobClient(file);
            // const buffer = await fs.readFile(filePath);
            // await blockBlobClient.upload(buffer, buffer.length, {
            //   blobHTTPHeaders: { blobContentType: 'application/pdf' },
            // });
          } else {
            this.logger.log('No Azure Blob Storage connection string set, skipping upload.');
          }
        }
      }

      this.logger.log('All documents processed successfully.');
    } catch (error) {
      this.logger.error(`Error processing documents: ${error.message}`);
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
