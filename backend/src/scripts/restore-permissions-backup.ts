// Usage: npx ts-node src/scripts/restore-permissions-backup.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.$executeRawUnsafe(`
    UPDATE users u
    SET permissions = b.permissions
    FROM _permissions_backup b
    WHERE u.id = b.id;
  `);
  console.log(`✅ ${count} utilisateurs restaurés depuis _permissions_backup`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
