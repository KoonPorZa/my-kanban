import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';
import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const MAX_LOGGED_PATH_LENGTH = 2_048;

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HttpRequest');

  use(request: Request, response: Response, next: NextFunction) {
    const requestId = this.resolveRequestId(request);
    const startedAt = process.hrtime.bigint();
    let logged = false;

    response.setHeader('x-request-id', requestId);

    const writeLog = (outcome: 'finished' | 'closed') => {
      if (logged) {
        return;
      }
      logged = true;
      response.off('finish', onFinish);
      response.off('close', onClose);

      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const entry = {
        event: 'http_request',
        requestId,
        method: request.method,
        path: request.path.slice(0, MAX_LOGGED_PATH_LENGTH),
        statusCode: response.statusCode,
        durationMs: Number(durationMs.toFixed(1)),
        outcome,
      };

      if (response.statusCode >= 500) {
        this.logger.error(entry);
      } else if (response.statusCode >= 400) {
        this.logger.warn(entry);
      } else {
        this.logger.log(entry);
      }
    };
    const onFinish = () => writeLog('finished');
    const onClose = () => writeLog('closed');

    response.once('finish', onFinish);
    response.once('close', onClose);
    next();
  }

  private resolveRequestId(request: Request) {
    const incoming = request.headers['x-request-id'];
    const candidate = Array.isArray(incoming) ? incoming[0] : incoming;

    return candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : randomUUID();
  }
}
