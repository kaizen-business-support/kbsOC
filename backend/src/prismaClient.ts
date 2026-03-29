import { PrismaClient } from '@prisma/client';

// Singleton partagé — une seule instance dans tout le processus Node.js.
// Plusieurs instances PrismaClient sur la même DB PostgreSQL provoquent
// des conflits de "prepared statements" et des erreurs de pool.
export const prisma = new PrismaClient();
