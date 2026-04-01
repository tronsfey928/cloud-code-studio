import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isProduction = process.env.NODE_ENV === 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as Record<string, unknown>).message as string ?? exception.message;

      if (Array.isArray(message)) {
        message = (message as string[]).join('; ');
      }
    } else if (exception instanceof Error) {
      message = isProduction ? 'Internal Server Error' : exception.message;
    }

    this.logger.error('Request error', {
      method: request.method,
      url: request.url,
      statusCode: status,
      message: exception instanceof Error ? exception.message : String(exception),
      stack: !isProduction && exception instanceof Error ? exception.stack : undefined,
    });

    response.status(status).json({
      code: status,
      message,
      data: null,
    });
  }
}
