import type { NextFunction } from 'express';
import { type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import type { FilterData } from '../../shared/types/invoiceFilter';
import { dbInstance } from '../controllers/database';

export const parseFilter = (query: string | undefined): FilterData[] | undefined => {
  if (!query) return undefined;
  try {
    const parsed = JSON.parse(query);
    return Array.isArray(parsed) ? (parsed as FilterData[]) : undefined;
  } catch {
    return undefined;
  }
};

export const requireDB = (_req: Request, res: Response, next: NextFunction) => {
  if (!dbInstance) {
    return res.status(400).json({
      success: false,
      message: 'Database is not initialized'
    });
  }
  next();
};

export const listDbLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please slow down.'
  }
});
