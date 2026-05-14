import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      realIp?: string;
    }
  }
}

/**
 * Extrait l'IP réelle du client en respectant X-Forwarded-For (premier
 * élément, trim). Requiert `app.set('trust proxy', true)` côté serveur.
 */
export function extractRealIp(req: Request, _res: Response, next: NextFunction): void {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    req.realIp = xff.split(',')[0].trim();
  } else if (Array.isArray(xff) && xff.length > 0) {
    req.realIp = String(xff[0]).split(',')[0].trim();
  } else {
    req.realIp = req.ip ?? '';
  }
  next();
}
