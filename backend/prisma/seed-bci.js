/**
 * seed-bci.js — Données de démonstration pour le tenant BCI
 *
 * Usage :  node prisma/seed-bci.js
 *
 * Ce script est IDEMPOTENT : il peut être relancé sans effet de bord.
 * Il ne supprime rien — il upserte ou crée uniquement les données manquantes.
 *
 * Comptes créés (mot de passe : Demo2024!)
 * ────────────────────────────────────────
 * Rôle                    | Email
 * ─────────────────────────|──────────────────────────
 * CHARGE_AFFAIRES          | ca1@bci.sn, ca2@bci.sn
 * ANALYSTE_RISQUES         | analyste@bci.sn
 * RESPONSABLE_RISQUES      | resp.risques@bci.sn
 * RESPONSABLE_ENGAGEMENTS  | resp.eng@bci.sn
 * COMITE_CREDIT            | comite@bci.sn
 * DIRECTION_GENERALE       | dg@bci.sn
 * ADMIN                    | admin@bci.sn
 * DIRECTION_JURIDIQUE      | juridique@bci.sn
 * BACK_OFFICE              | backoffice@bci.sn
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

const PASSWORD = 'Demo2024!';

// ─── Données utilisateurs de démonstration ────────────────────────────────────
const TEST_USERS = [
  {
    email: 'ca1@bci.sn',
    name: 'Amadou Diallo',
    role: 'CHARGE_AFFAIRES',
    jobTitle: "Chargé d'Affaires Senior",
    department: 'Commerce et Développement',
    branch: 'DKR-PL',
    permissions: ['view_applications', 'view_own', 'create_application', 'create_client', 'edit_client_data', 'manage_clients', 'financial_analysis'],
  },
  {
    email: 'ca2@bci.sn',
    name: 'Fatou Sow',
    role: 'CHARGE_AFFAIRES',
    jobTitle: "Chargée d'Affaires",
    department: 'Commerce et Développement',
    branch: 'DKR-AL',
    permissions: ['view_applications', 'view_own', 'create_application', 'create_client', 'edit_client_data', 'manage_clients', 'financial_analysis'],
  },
  {
    email: 'analyste@bci.sn',
    name: 'Moussa Traoré',
    role: 'ANALYSTE_RISQUES',
    jobTitle: 'Analyste Risques Principal',
    department: 'Risques et Conformité',
    branch: 'DKR-SG',
    permissions: ['view_applications', 'view_branch', 'analyze_credit', 'financial_analysis', 'score_applications', 'review_applications'],
  },
  {
    email: 'resp.risques@bci.sn',
    name: 'Aïssatou Ndiaye',
    role: 'RESPONSABLE_RISQUES',
    jobTitle: 'Responsable Direction des Risques',
    department: 'Risques et Conformité',
    branch: 'DKR-SG',
    permissions: ['view_applications', 'view_all', 'analyze_credit', 'financial_analysis', 'review_applications', 'application_review', 'approve_applications', 'manage_team', 'dispatch_applications'],
  },
  {
    email: 'resp.eng@bci.sn',
    name: 'Ibrahim Coulibaly',
    role: 'RESPONSABLE_ENGAGEMENTS',
    jobTitle: 'Responsable des Engagements',
    department: 'Crédit et Financement',
    branch: 'DKR-SG',
    permissions: ['view_applications', 'view_all', 'approve_applications', 'application_review', 'workflow_override', 'manage_team'],
  },
  {
    email: 'comite@bci.sn',
    name: 'Mariama Ba',
    role: 'COMITE_CREDIT',
    jobTitle: 'Présidente du Comité de Crédit',
    department: 'Direction Générale',
    branch: 'DKR-SG',
    permissions: ['view_applications', 'view_all', 'approve_applications', 'committee_review', 'committee_vote', 'final_approval', 'analytics', 'reports'],
  },
  {
    email: 'dg@bci.sn',
    name: 'Oumar Sarr',
    role: 'DIRECTION_GENERALE',
    jobTitle: 'Directeur Général',
    department: 'Direction Générale',
    branch: 'DKR-SG',
    permissions: ['view_applications', 'view_all', 'view_portfolio', 'analytics', 'reports', 'portfolio_analytics', 'risk_reporting', 'data_export'],
  },
  {
    email: 'admin@bci.sn',
    name: 'Seydou Keita',
    role: 'ADMIN',
    jobTitle: 'Administrateur Système',
    department: 'Informatique et Systèmes',
    branch: 'DKR-SG',
    // Toutes les permissions tenant — PAS de wildcard, PAS de manage_platform
    permissions: [
      'user_management','role_assignment','system_administration','system_configuration',
      'audit_logs','data_export','manage_notifications','manage_announcements',
      'manage_backup','view_all','view_branch','view_own','view_applications','view_portfolio',
      'analytics','reports','portfolio_analytics','risk_reporting','policy_configuration',
      'create_client','edit_client_data','manage_clients','create_application',
      'review_applications','application_review','analyze_credit','financial_analysis',
      'score_applications','benchmark_analysis','edit_analysis','approve_credit',
      'approve_applications','committee_review','committee_vote','final_approval',
      'risk_override','policy_exceptions','manage_branch','manage_team','workflow_override',
      'dispatch_applications','assign_analyst','view_analyst_workload',
    ],
  },
  {
    email: 'juridique@bci.sn',
    name: 'Rokhaya Diop',
    role: 'DIRECTION_JURIDIQUE',
    jobTitle: 'Directrice Juridique',
    department: 'Direction Générale',
    branch: 'DKR-SG',
    permissions: ['view_applications', 'view_all', 'approve_applications', 'application_review', 'analytics'],
  },
  {
    email: 'backoffice@bci.sn',
    name: 'Cheikh Fall',
    role: 'BACK_OFFICE',
    jobTitle: 'Chargé Back-Office',
    department: 'Opérations et Back-office',
    branch: 'DKR-SG',
    permissions: ['view_applications', 'view_branch', 'application_review'],
  },
];

// ─── Clients de démonstration ─────────────────────────────────────────────────
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
  const hashedPwd = await bcrypt.hash(PASSWORD, 12);

  console.log('\n═══ Seed BCI ═══════════════════════════════════════════════');

  // ── 1. Récupérer la compagnie BCI ──────────────────────────────────────────
  const bci = await prisma.company.findUnique({ where: { code: 'BCI' } });
  if (!bci) {
    console.error('❌ Compagnie BCI introuvable — lancez d\'abord : node prisma/migrate-tenant.js');
    process.exit(1);
  }
  console.log(`✓ Compagnie BCI : ${bci.id}`);

  // ── 2. Utilisateurs de démonstration ──────────────────────────────────────
  console.log('\n── Utilisateurs ──');
  const createdUsers = [];
  for (const u of TEST_USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, jobTitle: u.jobTitle, department: u.department, branch: u.branch, permissions: u.permissions, isActive: true },
      create: {
        email: u.email,
        passwordHash: hashedPwd,
        name: u.name,
        role: u.role,
        jobTitle: u.jobTitle,
        department: u.department,
        branch: u.branch,
        permissions: u.permissions,
        isActive: true,
      },
    });
    createdUsers.push(user);

    // CompanyMembership BCI
    await prisma.companyMembership.upsert({
      where: { userId_companyId: { userId: user.id, companyId: bci.id } },
      update: { role: u.role, isActive: true },
      create: { userId: user.id, companyId: bci.id, role: u.role, isActive: true },
    });

    console.log(`  ${u.role.padEnd(25)} ${u.email}`);
  }

  // ── 3. Clients de démonstration ────────────────────────────────────────────
  console.log('\n── Clients ──');
  // Le CA1 sera le créateur des clients de démo
  const adminUser = createdUsers.find(u => u.email === 'admin@bci.sn') || createdUsers[0];
  const createdClients = [];
  for (const c of TEST_CLIENTS) {
    const existing = await prisma.client.findFirst({
      where: { companyId: bci.id, companyName: c.companyName },
    });
    if (!existing) {
      const client = await prisma.client.create({
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
      createdClients.push(client);
      console.log(`  Créé : ${c.companyName}`);
    } else {
      createdClients.push(existing);
      console.log(`  Existant : ${c.companyName}`);
    }
  }

  // ── 4. Limites d'approbation BCI ───────────────────────────────────────────
  console.log('\n── Limites d\'approbation ──');
  const approvalLimits = [
    { role: 'CHARGE_AFFAIRES',         displayName: "Chargé d'Affaires",       minAmount: 0,          maxAmount: 5_000_000,    order: 1, reviewDuration: 1440 },
    { role: 'RESPONSABLE_ENGAGEMENTS', displayName: 'Responsable Engagements', minAmount: 5_000_001,  maxAmount: 50_000_000,   order: 2, reviewDuration: 2880 },
    { role: 'COMITE_CREDIT',           displayName: 'Comité de Crédit',        minAmount: 50_000_001, maxAmount: 500_000_000,  order: 3, reviewDuration: 4320 },
    { role: 'DIRECTION_GENERALE',      displayName: 'Direction Générale',      minAmount: 500_000_001, maxAmount: 2_000_000_000, order: 4, reviewDuration: 2880 },
  ];
  for (const al of approvalLimits) {
    const existing = await prisma.approvalLimit.findFirst({
      where: { companyId: bci.id, role: al.role },
    });
    if (!existing) {
      await prisma.approvalLimit.create({ data: { ...al, companyId: bci.id } });
      console.log(`  Créé : ${al.role} → ${al.maxAmount.toLocaleString('fr-FR')} ${al.currency}`);
    } else {
      console.log(`  Existant : ${al.role}`);
    }
  }

  // ── 5. Types de crédit BCI ─────────────────────────────────────────────────
  console.log('\n── Types de crédit ──');
  const creditTypes = [
    {
      code: 'CT',
      name: 'Crédit Court Terme',
      description: 'Financement de la trésorerie et du fonds de roulement (≤ 1 an)',
      defaultRate: 9.5, minRate: 7.0, maxRate: 14.0,
      minDuration: 1, maxDuration: 12, requiresCollateral: false,
    },
    {
      code: 'CMT',
      name: 'Crédit Moyen Terme',
      description: 'Financement des investissements à moyen terme (1 à 5 ans)',
      defaultRate: 10.5, minRate: 8.0, maxRate: 15.0,
      minDuration: 13, maxDuration: 60, requiresCollateral: true,
    },
    {
      code: 'CLT',
      name: 'Crédit Long Terme',
      description: 'Financement des investissements structurants (> 5 ans)',
      defaultRate: 11.0, minRate: 8.5, maxRate: 15.5,
      minDuration: 61, maxDuration: 240, requiresCollateral: true,
    },
    {
      code: 'SPOT',
      name: 'Crédit Spot',
      description: 'Facilité de caisse ponctuelle — besoins immédiats de trésorerie',
      defaultRate: 12.0, minRate: 10.0, maxRate: 16.0,
      minDuration: 1, maxDuration: 3, requiresCollateral: false,
    },
    {
      code: 'DCRV',
      name: 'Découvert sur compte courant',
      description: 'Autorisation de découvert renouvelable sur compte courant',
      defaultRate: 13.0, minRate: 11.0, maxRate: 18.0,
      minDuration: 1, maxDuration: 12, requiresCollateral: false,
    },
    {
      code: 'LEASING',
      name: 'Crédit-bail (Leasing)',
      description: 'Financement d\'équipements par crédit-bail',
      defaultRate: 10.0, minRate: 8.0, maxRate: 14.0,
      minDuration: 24, maxDuration: 84, requiresCollateral: false,
    },
    {
      code: 'PME',
      name: 'Crédit PME',
      description: 'Produit dédié aux PME/PMI — conditions préférentielles BCEAO',
      defaultRate: 8.5, minRate: 6.5, maxRate: 12.0,
      minDuration: 6, maxDuration: 84, requiresCollateral: false,
    },
    {
      code: 'HABITAT',
      name: 'Crédit Habitat',
      description: 'Financement immobilier résidentiel et professionnel',
      defaultRate: 9.0, minRate: 7.5, maxRate: 13.0,
      minDuration: 60, maxDuration: 240, requiresCollateral: true,
    },
  ];

  let ctCreated = 0;
  for (const ct of creditTypes) {
    const existing = await prisma.creditType.findFirst({
      where: { companyId: bci.id, code: ct.code },
    });
    if (!existing) {
      await prisma.creditType.create({
        data: { ...ct, companyId: bci.id, isActive: true },
      });
      ctCreated++;
      console.log(`  Créé : [${ct.code}] ${ct.name}`);
    } else {
      console.log(`  Existant : [${ct.code}] ${ct.name}`);
    }
  }

  // ── 6. Résumé ──────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`✓ ${TEST_USERS.length} utilisateurs (upsert)`);
  console.log(`✓ ${createdClients.length} clients`);
  console.log(`✓ Mot de passe commun : ${PASSWORD}`);
  console.log('\nComptes disponibles :');
  console.log('  superadmin@optimuscredit.sn  SuperAdmin2024!  (SUPER_ADMIN plateforme)');
  for (const u of TEST_USERS) {
    console.log(`  ${u.email.padEnd(30)} ${PASSWORD}  (${u.role})`);
  }
}

main()
  .catch(e => { console.error('❌', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
