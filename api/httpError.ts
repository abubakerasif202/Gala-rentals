export class HttpError extends Error {
  status: number;
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = statusCode;
    this.statusCode = statusCode;
  }
}

export const isHttpError = (error: unknown): error is HttpError =>
  error instanceof HttpError;
