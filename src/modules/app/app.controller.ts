import { Controller, Get, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { Response } from 'express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('policy')
  getPolicy(@Res() res: Response) {
    res.sendFile('policy.html', { root: process.cwd() + '/data' });
  }

  @Get('terms')
  getTerms(@Res() res: Response) {
    res.sendFile('terms.html', { root: process.cwd() + '/data' });
  }
}
