/**
 * migrate-contract-permissions.js
 *
 * Script idempotent qui ajoute les permissions liées aux contrats juridiques
 * aux users existants, sans toucher au reste de leurs permissions.
 *
 * Usage : node prisma/migrate-contract-permissions.js
 *
 * Règles :
 *   - DIRECTION_JURIDIQUE      → manage_contract_templates, generate_contracts, view_contracts
 *   - ADMIN, SUPER_ADMIN       → manage_contract_templates, view_contracts
 *   - RESPONSABLE_ENGAGEMENTS  → view_contracts
 *   - BACK_OFFICE              → view_contracts
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PERMS_BY_ROLE = {
  DIRECTION_JURIDIQUE:     ['manage_contract_templates', 'generate_contracts', 'view_contracts'],
  ADMIN:                   ['manage_contract_templates', 'view_contracts'],
  SUPER_ADMIN:             ['manage_contract_templates', 'view_contracts'],
  RESPONSABLE_ENGAGEMENTS: ['view_contracts'],
  BACK_OFFICE:             ['view_contracts'],
};

function mergePerms(existing, toAdd) {
  const set = new Set(Array.isArray(existing) ? existing : []);
  let changed = false;
  for (const p of toAdd) {
    if (!set.has(p)) { set.add(p); changed = true; }
  }
  return { merged: Array.from(set), changed };
}

(async () => {
  console.log('🔄 Migration permissions contrats…\n');
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const [role, perms] of Object.entries(PERMS_BY_ROLE)) {
    const users = await prisma.user.findMany({
      where: { role },
      select: { id: true, email: true, permissions: true },
    });
    for (const u of users) {
      const { merged, changed } = mergePerms(u.permissions, perms);
      if (!changed) {
        console.log(`  ⏭  ${u.email.padEnd(28)} (${role}) — déjà à jour`);
        totalSkipped++;
        continue;
      }
      await prisma.user.update({
        where: { id: u.id },
        data: { permissions: merged },
      });
      console.log(`  ✅  ${u.email.padEnd(28)} (${role}) — ajouté: ${perms.filter(p => !(u.permissions || []).includes(p)).join(', ')}`);
      totalUpdated++;
    }
  }

  console.log(`\n📊 Résultat : ${totalUpdated} user(s) mis à jour, ${totalSkipped} déjà à jour.`);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('❌ Erreur :', e);
  await prisma.$disconnect();
  process.exit(1);
});
