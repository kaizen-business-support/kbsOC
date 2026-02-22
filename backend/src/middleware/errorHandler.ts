import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export class AppError extends Error {
  statusCode: number;
  code?: string;
  
  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'AppError';
  }
}

// Async handler wrapper to catch async errors
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): Response => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  console.error('❌ API Error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });

  // Prisma validation error
  if (err.name === 'PrismaClientValidationError') {
    error.message = 'Données de requête invalides';
    error.statusCode = 400;
  }

  // Prisma unique constraint error
  if (err.code === 'P2002') {
    error.message = 'Cette ressource existe déjà';
    error.statusCode = 409;
  }

  // Prisma record not found error
  if (err.code === 'P2025') {
    error.message = 'Ressource non trouvée';
    error.statusCode = 404;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error.message = 'Token invalide';
    error.statusCode = 401;
  }

  if (err.name === 'TokenExpiredError') {
    error.message = 'Token expiré';
    error.statusCode = 401;
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    error.message = 'Données de validation invalides';
    error.statusCode = 400;
  }

  // Default to 500 server error
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Erreur interne du serveur';

  return res.status(statusCode).json({
    success: false,
    error: message,
    statusCode,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    timestamp: new Date().toISOString(),
  });
};