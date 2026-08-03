// server/src/controllers/telemetry.controller.ts
import { Request, Response, NextFunction } from 'express';
import { telemetrySchema } from './telemetry.validations.js';
import { ingestTelemetry } from '@/services/telemetryIngestService.js';
import { BadRequestError } from '@/exceptions/http.exception.js';

export async function postTelemetry(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = telemetrySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.issues.map((i) => i.message).join(', '));
    }
    await ingestTelemetry(parsed.data);
    // 202 Accepted -- we took it, we haven't processed it yet. Accurate,
    // not just conventional: the worker does the real work asynchronously.
    res.status(202).json({ accepted: true });
  } catch (err) {
    next(err);
  }
}
