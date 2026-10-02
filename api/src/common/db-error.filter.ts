import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { Response } from 'express';

/**
 * Catches database/driver errors (and any other non-HTTP exception) and returns a generic message.
 * The real error (SQL, column names, constraint details) is logged server-side only — never sent
 * to the caller, so the DB schema can't be probed through error responses.
 */
@Catch()
export class DbErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('DbError');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    // Let normal HTTP exceptions (400/401/403/404/409 …) pass through unchanged.
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json(exception.getResponse());
      return;
    }

    // DB driver error or anything unexpected → log the detail, return a clean 500.
    if (exception instanceof QueryFailedError) {
      this.logger.error(`QueryFailedError: ${exception.message}`);
    } else {
      this.logger.error(`Unhandled: ${exception instanceof Error ? exception.stack : String(exception)}`);
    }
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
    });
  }
}
