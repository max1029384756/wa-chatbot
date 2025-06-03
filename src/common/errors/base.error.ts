import { HttpStatus } from '@nestjs/common';

export type TErrorParams = Array<string | number>;

export type TCustomError = { message: string; code?: HttpStatus };

export class BaseError extends Error {
  public code: HttpStatus;
  public params?: TErrorParams;

  constructor(customError: TCustomError, params?: TErrorParams) {
    super(customError.message);
    this.code = customError.code || HttpStatus.INTERNAL_SERVER_ERROR;
    this.params = params;
  }
}
