// backend/prisma/migrate-tenant.js
// Script idempotent — peut être relancé sans effet de bord
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Migration multi-tenant — données existantes vers BCI');

  // 1. Créer la compagnie BCI (idempotent via upsert)
  const bci = await prisma.company.upsert({
    where: { code: 'BCI' },
    update: {},
    create: {
      name: "BCI – Banque de Crédit et d'Investissement",
      code: 'BCI',
      isActive: true,
    },
  });
  console.log('Compagnie BCI : ' + bci.id);

  // 2. Rattacher toutes les données existantes à BCI
  const models = [
    { name: 'client',            table: prisma.client },
    { name: 'creditApplication', table: prisma.creditApplication },
    { name: 'creditPolicy',      table: prisma.creditPolicy },
    { name: 'creditType',        table: prisma.creditType },
    { name: 'approvalLimit',     table: prisma.approvalLimit },
    { name: 'powerDelegation',   table: prisma.powerDelegation },
    { name: 'notification',      table: prisma.notification },
    { name: 'announcement',      table: prisma.announcement },
    { name: 'department',        table: prisma.department },
    { name: 'branch',            table: prisma.branch },
  ];

  for (const { name, table } of models) {
    const updated = await table.updateMany({
      where: { companyId: null },
      data:  { companyId: bci.id },
    });
    console.log(name + ': ' + updated.count + ' lignes rattachées à BCI');
  }

  // 3. Créer CompanyMembership pour chaque User existant (idempotent)
  const users = await prisma.user.findMany({ select: { id: true, role: true } });
  let membershipsCreated = 0;
  for (const user of users) {
    const existing = await prisma.companyMembership.findUnique({
      where: { userId_companyId: { userId: user.id, companyId: bci.id } },
    });
    if (!existing) {
      await prisma.companyMembership.create({
        data: { userId: user.id, companyId: bci.id, role: user.role, isActive: true },
      });
      membershipsCreated++;
    }
  }
  console.log('CompanyMembership : ' + membershipsCreated + ' créées (' + (users.length - membershipsCreated) + ' déjà existantes)');

  // 4. Promouvoir un SUPER_ADMIN (idempotent)
  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' }
  });
  if (!existingSuperAdmin) {
    const firstAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN', isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (firstAdmin) {
      await prisma.user.update({
        where: { id: firstAdmin.id },
        data:  { role: 'SUPER_ADMIN' },
      });
      await prisma.companyMembership.updateMany({
        where: { userId: firstAdmin.id, companyId: bci.id },
        data:  { role: 'SUPER_ADMIN' },
      });
      console.log('SUPER_ADMIN promu : ' + firstAdmin.id);
    } else {
      console.warn('Aucun ADMIN trouvé pour promotion SUPER_ADMIN');
    }
  } else {
    console.log('SUPER_ADMIN déjà existant : ' + existingSuperAdmin.id);
  }

  // 5. Vérification intégrité
  console.log('\nVérification intégrité :');
  const checks = [
    prisma.client.count({ where: { companyId: null } }),
    prisma.creditApplication.count({ where: { companyId: null } }),
    prisma.creditPolicy.count({ where: { companyId: null } }),
    prisma.department.count({ where: { companyId: null } }),
    prisma.branch.count({ where: { companyId: null } }),
  ];
  const [c1, c2, c3, c4, c5] = await Promise.all(checks);
  if (c1 + c2 + c3 + c4 + c5 > 0) {
    console.error('Données orphelines : clients=' + c1 + ', applications=' + c2 + ', policies=' + c3 + ', departments=' + c4 + ', branches=' + c5);
    process.exit(1);
  }
  console.log('Zéro ligne orpheline — migration réussie');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
