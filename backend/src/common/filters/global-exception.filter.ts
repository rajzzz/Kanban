import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

interface NestExceptionResponse {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const resBody = exception.getResponse() as NestExceptionResponse | string;

      if (typeof resBody === 'string') {
        message = resBody;
        error = exception.name;
      } else if (typeof resBody === 'object' && resBody !== null) {
        if (resBody.message !== undefined) {
          message = resBody.message;
        }
        if (resBody.error !== undefined) {
          error = resBody.error;
        } else {
          error = exception.name;
        }
      }
    } else {
      // Log unhandled non-Http exceptions
      this.logger.error(exception);
      if (exception instanceof Error) {
        message = exception.message;
        error = exception.name;
      }
    }

    response.status(statusCode).json({
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
    });
  }
}
