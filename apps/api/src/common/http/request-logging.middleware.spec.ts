import { EventEmitter } from 'node:events';

import type { NextFunction, Request, Response } from 'express';
import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RequestLoggingMiddleware } from './request-logging.middleware';

class ResponseStub extends EventEmitter {
  statusCode = 200;
  readonly headers = new Map<string, string>();

  setHeader(name: string, value: string) {
    this.headers.set(name, value);
    return this;
  }
}

describe('RequestLoggingMiddleware', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reuses a valid request ID and logs no headers or query values', () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const response = new ResponseStub();
    const request = {
      method: 'GET',
      path: '/api/v1/issues',
      headers: {
        'x-request-id': 'request-123',
        authorization: 'Bearer must-not-be-logged',
      },
      originalUrl: '/api/v1/issues?token=must-not-be-logged',
    } as unknown as Request;
    const next = vi.fn() as NextFunction;

    new RequestLoggingMiddleware().use(request, response as unknown as Response, next);
    response.emit('finish');

    expect(next).toHaveBeenCalledOnce();
    expect(response.headers.get('x-request-id')).toBe('request-123');
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'http_request',
        requestId: 'request-123',
        path: '/api/v1/issues',
        statusCode: 200,
      })
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain('must-not-be-logged');
  });

  it('generates a request ID and records a closed response only once', () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const response = new ResponseStub();
    response.statusCode = 499;
    const request = {
      method: 'POST',
      path: '/mcp',
      headers: { 'x-request-id': 'invalid request id' },
    } as unknown as Request;

    new RequestLoggingMiddleware().use(
      request,
      response as unknown as Response,
      vi.fn() as NextFunction
    );
    response.emit('close');
    response.emit('finish');

    expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'closed' }));
  });
});
