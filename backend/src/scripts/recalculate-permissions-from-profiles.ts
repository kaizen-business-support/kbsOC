// Usage: npx ts-node src/scripts/recalculate-permissions-from-profiles.ts [--dry-run]
import { PrismaClient } from '@prisma/client';
import { derivePermissions } from '../constants/moduleToPermissionsMap';
import type { ModuleAccess } from '../constants/moduleToPermissionsMap';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(DRY_RUN ? '🔍 Mode dry-run — aucune écriture' : '✏️  Mode live — écriture en DB');

  const profiles = await prisma.moduleProfile.findMany();
  console.log(`\n${profiles.length} profil(s) trouvé(s)\n`);

  if (!DRY_RUN) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS _permissions_backup AS
      SELECT id, permissions, role, updated_at FROM users;
    `).catch(() =>
      prisma.$executeRawUnsafe(`
        TRUNCATE _permissions_backup;
        INSERT INTO _permissions_backup SELECT id, permissions, role, updated_at FROM users;
      `)
    );
    console.log('✅ Backup des permissions actuelles dans _permissions_backup\n');
  }

  for (const profile of profiles) {
    const { role, companyId, modules, defaultScope } = profile;
    const isAdminRole = ['ADMIN', 'SUPER_ADMIN'].includes(role);
    const permissions = isAdminRole ? ['*'] : derivePermissions(modules as unknown as Record<string, ModuleAccess>, defaultScope);

    console.log(`Rôle: ${role} (companyId: ${companyId})`);
    console.log(`  → ${permissions.length} permissions: ${permissions.slice(0, 5).join(', ')}${permissions.length > 5 ? '...' : ''}`);

    if (!DRY_RUN) {
      await prisma.$transaction([
        prisma.rolePermission.upsert({
          where: { role: role as any },
          update: { permissions },
          create: { role: role as any, label: role, permissions, isActive: true },
        }),
        prisma.user.updateMany({
          where: { role: role as any, memberships: { some: { companyId } } },
          data: { permissions },
        }),
      ]);
      console.log('  ✅ DB mise à jour');
    }
  }

  console.log('\nMigration terminée.');
  if (DRY_RUN) {
    console.log('\nRelancer sans --dry-run pour appliquer les changements.');
    console.log('Pour rollback (après une exécution live): npx ts-node src/scripts/restore-permissions-backup.ts');
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
