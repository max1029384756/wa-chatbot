import { BaseError } from '@/common/errors';
import { HttpStatus } from '@nestjs/common';

export class ConfigNotSetError extends BaseError {
  constructor(readonly configKeyPath: string) {
    super({
      message: `config key ${configKeyPath} is not set`,
      code: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  }
}
