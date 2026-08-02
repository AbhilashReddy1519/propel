export class HttpException extends Error {
  public statusCode: number;
  public override message: string;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends HttpException {
  constructor(message = 'Bad Request') {
    super(400, message);
  }
}

export class UnauthorizedError extends HttpException {
  constructor(message = 'Unauthorized') {
    super(401, message);
  }
}

export class ForbiddenError extends HttpException {
  constructor(message = 'Forbidden') {
    super(403, message);
  }
}

export class NotFoundError extends HttpException {
  constructor(message = 'Not Found') {
    super(404, message);
  }
}

export class ConflictError extends HttpException {
  constructor(message = 'Conflict') {
    super(409, message);
  }
}

export class ValidationError extends HttpException {
  constructor(message = 'Validation Error') {
    super(422, message);
  }
}

export class InternalServerError extends HttpException {
  constructor(message = 'Internal Server Error') {
    super(500, message);
  }
}
