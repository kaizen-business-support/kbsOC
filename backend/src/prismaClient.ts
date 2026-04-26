import { PrismaClient } from '@prisma/client';

// Singleton partagé — une seule instance dans tout le processus Node.js.
// Plusieurs instances PrismaClient sur la même DB PostgreSQL provoquent
// des conflits de "prepared statements" et des erreurs de pool.

// Injecter connection_limit et pool_timeout dans l'URL si non déjà présents,
// pour éviter l'épuisement du pool lors de démos avec plusieurs utilisateurs.
const rawUrl = process.env.DATABASE_URL || '';
const dbUrl = rawUrl.includes('connection_limit')
  ? rawUrl
  : `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}connection_limit=20&pool_timeout=20`;

export const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
});
