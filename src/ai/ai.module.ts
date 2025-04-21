import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { DocumentsService } from './documents.service';
import { DocumentsCommand } from './documents.command';
import { UserContextModule } from 'src/user-context/user-context.module';

@Module({
  imports: [UserContextModule],
  providers: [AiService, DocumentsService, DocumentsCommand],
  exports: [AiService, DocumentsService],
})
export class AiModule {}
