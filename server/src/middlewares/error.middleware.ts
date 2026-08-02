import { Request, Response, NextFunction } from 'express';
import { HttpException } from '@/exceptions/http.exception.js';
import logger from '@/utils/logger.js';
import config from '@/config/env.js';

export const errorHandler = (error: Error, req: Request, res: Response, _: NextFunction) => {
  logger.error(`Error: ${error.message}`);
  logger.error(`Stack: ${error.stack}`);

  if (error instanceof HttpException) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      statusCode: error.statusCode,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      ...(config.env === 'development' && { stack: error.stack }),
    });
  }

  // Default error
  return res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: config.env === 'development' ? error.message : 'Something went wrong',
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    ...(config.env === 'development' && { stack: error.stack }),
  });
};
