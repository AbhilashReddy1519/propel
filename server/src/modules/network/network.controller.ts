import { Request, Response, NextFunction } from 'express';
import { BadRequestError } from '@/exceptions/http.exception.js';
import { listDts, listPolesForDt } from './network.service.js';

export async function getDts(_req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await listDts();
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

export async function getPolesForDt(req: Request, res: Response, next: NextFunction) {
  try {
    const { dtId } = req.params;
    if (typeof dtId !== 'string' || dtId.length === 0) {
      throw new BadRequestError('dtId is required in the URL.');
    }
    const rows = await listPolesForDt(dtId);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}
