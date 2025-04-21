import { Command, Positional } from 'nestjs-command';
import { Injectable } from '@nestjs/common';
import { DocumentsService } from './documents.service';

// npx nestjs-command docs:parse data

@Injectable()
export class DocumentsCommand {
  constructor(private readonly documentsService: DocumentsService) {}

  @Command({
    command: 'docs:parse <folder>',
    describe: 'Parse and save documents from the specified data folder',
  })
  async parseDocuments(
    @Positional({
      name: 'folder',
      describe: 'The folder containing the documents to parse',
      type: 'string',
      default: 'data', // Default folder
    })
    folder: string,
  ) {
    await this.documentsService.parseAndSaveDocuments(folder);
  }
}
