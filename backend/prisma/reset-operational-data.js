/**
 * reset-operational-data.js — Réinitialisation des données opérationnelles BCI
 *
 * Supprime toutes les données opérationnelles du tenant BCI :
 *   clients, demandes de crédit, workflows, documents, contrats générés,
 *   notifications, annonces, logs d'audit, délégations de pouvoir, scope delegates
 *
 * Préserve la configuration :
 *   utilisateurs, politiques de crédit, types de crédit, limites d'approbation,
 *   mur chinois, templates de notifications, modèles de contrats, départements/agences
 *
 * Puis recrée les 10 clients de démonstration BCI.
 *
 * Usage : node prisma/reset-operational-data.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ─── Clients de démonstration (identiques à seed-bci.js) ─────────────────────
const TEST_CLIENTS = [
  { companyName: 'Société Générale de Commerce du Sénégal', rccm: 'SN-DKR-2018-B-12345', ninea: '001234567', sector: 'Commerce', legalForm: 'SA', headquarters: 'Dakar, Plateau' },
  { companyName: 'Industries Textiles du Sahel', rccm: 'SN-DKR-2019-B-23456', ninea: '002345678', sector: 'Industrie', legalForm: 'SARL', headquarters: 'Dakar, Parcelles Assainies' },
  { companyName: 'Transport & Logistique Express SA', rccm: 'SN-DKR-2017-B-34567', ninea: '003456789', sector: 'Transport', legalForm: 'SA', headquarters: 'Dakar, Zone Industrielle' },
  { companyName: 'Entreprise de Construction Moderne', rccm: 'SN-THS-2020-B-45678', ninea: '004567890', sector: 'Construction', legalForm: 'SARL', headquarters: 'Thiès' },
  { companyName: 'Pharmacie Centrale de Dakar', rccm: 'SN-DKR-2016-B-56789', ninea: '005678901', sector: 'Santé', legalForm: 'SARL', headquarters: 'Dakar, Plateau' },
  { companyName: 'Agro-alimentaire du Fleuve', rccm: 'SN-STL-2018-B-67890', ninea: '006789012', sector: 'Agro-industrie', legalForm: 'SA', headquarters: 'Saint-Louis' },
  { companyName: 'Cabinet Immobilier Dakari', rccm: 'SN-DKR-2021-B-78901', ninea: '007890123', sector: 'Immobilier', legalForm: 'SARL', headquarters: 'Dakar, Almadies' },
  { companyName: 'BTP Sénégal Infrastructure', rccm: 'SN-DKR-2015-B-89012', ninea: '008901234', sector: 'Construction', legalForm: 'SA', headquarters: 'Dakar, VDN' },
  { companyName: 'Import-Export Diallo & Associés', rccm: 'SN-DKR-2019-B-90123', ninea: '009012345', sector: 'Commerce', legalForm: 'SARLU', headquarters: 'Dakar, Colobane' },
  { companyName: 'École Supérieure de Technologie', rccm: 'SN-DKR-2020-B-01234', ninea: '010123456', sector: 'Éducation', legalForm: 'SA', headquarters: 'Dakar, Liberté VI' },
];

async function main() {
  console.log('\n═══ Reset données opérationnelles BCI ═══════════════════════════');

  // ── 0. Vérifier que BCI existe ─────────────────────────────────────────────
  const bci = await prisma.company.findUnique({ where: { code: 'BCI' } });
  if (!bci) {
    console.error("❌ Compagnie BCI introuvable — lancez d'abord : node prisma/migrate-tenant.js");
    process.exit(1);
  }
  console.log(`✓ Compagnie BCI : ${bci.id}`);

  // ── 1. Scope delegates ─────────────────────────────────────────────────────
  const scopeDelegatesDeleted = await prisma.scopeDelegate.deleteMany({
    where: { companyId: bci.id },
  });
  console.log(`  Supprimés : ${scopeDelegatesDeleted.count} scope delegate(s)`);

  // ── 2. Délégations de pouvoir ─────────────────────────────────────────────
  const delegationsDeleted = await prisma.powerDelegation.deleteMany({
    where: { companyId: bci.id },
  });
  console.log(`  Supprimés : ${delegationsDeleted.count} délégation(s) de pouvoir`);

  // ── 3. Notifications ───────────────────────────────────────────────────────
  const notifDeleted = await prisma.notification.deleteMany({
    where: { companyId: bci.id },
  });
  console.log(`  Supprimés : ${notifDeleted.count} notification(s)`);

  // ── 4. Annonces ────────────────────────────────────────────────────────────
  const announcementsDeleted = await prisma.announcement.deleteMany({
    where: { companyId: bci.id },
  });
  console.log(`  Supprimés : ${announcementsDeleted.count} annonce(s)`);

  // ── 5. Logs d'audit liés aux demandes BCI (avant suppression des demandes) ─
  // Détacher d'abord les audit_logs liés aux applications BCI
  const bciApplicationIds = await prisma.creditApplication.findMany({
    where: { companyId: bci.id },
    select: { id: true },
  });
  const appIds = bciApplicationIds.map(a => a.id);

  if (appIds.length > 0) {
    await prisma.auditLog.updateMany({
      where: { applicationId: { in: appIds } },
      data: { applicationId: null },
    });
  }

  // Supprimer les audit_logs des membres BCI (hors SUPER_ADMIN)
  const bciUserIds = await prisma.companyMembership.findMany({
    where: { companyId: bci.id },
    select: { userId: true },
  });
  const userIds = bciUserIds.map(m => m.userId);

  const auditDeleted = await prisma.auditLog.deleteMany({
    where: { userId: { in: userIds } },
  });
  console.log(`  Supprimés : ${auditDeleted.count} log(s) d'audit`);

  // ── 6. Clients BCI (cascade → applications, financial_data, workflow_steps,
  //        documents, generated_contracts, contract_signatories) ──────────────
  const clientsDeleted = await prisma.client.deleteMany({
    where: { companyId: bci.id },
  });
  console.log(`  Supprimés : ${clientsDeleted.count} client(s) + dossiers en cascade`);

  // ── 7. Webhook event logs (nettoyage global — pas de FK tenant) ────────────
  const webhookDeleted = await prisma.webhookEventLog.deleteMany({});
  console.log(`  Supprimés : ${webhookDeleted.count} webhook log(s)`);

  // ── 8. Backup logs ─────────────────────────────────────────────────────────
  const backupLogsDeleted = await prisma.backupLog.deleteMany({});
  console.log(`  Supprimés : ${backupLogsDeleted.count} backup log(s)`);

  // ── 9. Recréer les clients de démonstration ───────────────────────────────
  console.log('\n── Recréation des clients de démonstration ──');
  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@bci.sn' } });
  if (!adminUser) {
    console.error('❌ Utilisateur admin@bci.sn introuvable — relancez seed-bci.js d\'abord');
    process.exit(1);
  }

  for (const c of TEST_CLIENTS) {
    await prisma.client.create({
      data: {
        ...c,
        companyId: bci.id,
        isActive: true,
        contactPerson: null,
        phone: null,
        email: null,
        cofi: null,
        establishedYear: 2010 + Math.floor(Math.random() * 10),
        createdBy: adminUser.id,
      },
    });
    console.log(`  Créé : ${c.companyName}`);
  }

  // ── 10. Résumé ─────────────────────────────────────────────────────────────
  const finalCounts = await Promise.all([
    prisma.client.count({ where: { companyId: bci.id } }),
    prisma.creditApplication.count({ where: { companyId: bci.id } }),
    prisma.notification.count({ where: { companyId: bci.id } }),
    prisma.auditLog.count(),
  ]);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`✓ Clients BCI          : ${finalCounts[0]}`);
  console.log(`✓ Demandes de crédit   : ${finalCounts[1]} (doit être 0)`);
  console.log(`✓ Notifications        : ${finalCounts[2]} (doit être 0)`);
  console.log(`✓ Logs d'audit         : ${finalCounts[3]} (doit être 0)`);
  console.log('\n  Base propre — prêt pour un test de bout en bout.');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main()
  .catch(e => { console.error('❌', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
