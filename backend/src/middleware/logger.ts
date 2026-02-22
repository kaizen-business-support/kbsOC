import { Request, Response, NextFunction } from 'express';

export const logger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const timestamp = new Date().toISOString();
    
    const logInfo = {
      timestamp,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent') || 'Unknown',
    };

    // Different log levels based on status code
    if (res.statusCode >= 500) {
      console.error('🚨 SERVER ERROR:', logInfo);
    } else if (res.statusCode >= 400) {
      console.warn('⚠️  CLIENT ERROR:', logInfo);
    } else {
      console.log('✅ REQUEST:', `${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    }
  });

  next();
};