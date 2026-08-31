import type { Response } from 'express';

import { ArgumentsHost, Catch, type ExceptionFilter } from '@nestjs/common';

import {
  DomainError,
  DomainConflictError,
  DomainUnauthorizedError,
  ResourceNotFoundError,
  VersionConflictError,
  DomainValidationError,
} from '../domain/domain-errors';

@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(error: DomainError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    response.status(this.statusFor(error)).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  private statusFor(error: DomainError) {
    if (error instanceof ResourceNotFoundError) return 404;
    if (error instanceof DomainUnauthorizedError) return 401;
    if (error instanceof VersionConflictError || error instanceof DomainConflictError) return 409;
    if (error instanceof DomainValidationError) return 400;
    return 500;
  }
}
