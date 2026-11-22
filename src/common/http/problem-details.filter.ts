import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ProblemDetails {
  code?: string;
  detail: string;
  instance: string;
  status: number;
  title: string;
  type: string;
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  public catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : null;

    const details: ProblemDetails = {
      detail: this.getDetail(exceptionResponse, status),
      instance: request.originalUrl,
      status,
      title: this.getTitle(status),
      type: `https://httpstatuses.com/${status.toString()}`,
    };
    const code = this.getCode(exceptionResponse);
    if (code !== undefined) {
      details.code = code;
    }

    response.status(status).type('application/problem+json').json(details);
  }

  private getDetail(exceptionResponse: string | object | null, status: number): string {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }
    if (exceptionResponse !== null && 'message' in exceptionResponse) {
      const message = exceptionResponse.message;
      if (typeof message === 'string') {
        return message;
      }
      if (Array.isArray(message)) {
        return message.filter((item): item is string => typeof item === 'string').join(' ');
      }
    }

    return status === 500 ? 'An unexpected error occurred.' : this.getTitle(status);
  }

  private getCode(exceptionResponse: string | object | null): string | undefined {
    if (
      exceptionResponse !== null &&
      typeof exceptionResponse === 'object' &&
      'code' in exceptionResponse
    ) {
      return typeof exceptionResponse.code === 'string' ? exceptionResponse.code : undefined;
    }
    return undefined;
  }

  private getTitle(status: number): string {
    const title = HttpStatus[status];
    return typeof title === 'string' ? title : 'Error';
  }
}
