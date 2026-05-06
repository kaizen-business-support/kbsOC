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
    permissions: ['view_applications', 'view_all', 'approve_applications', 'application_review', 'workflow_override', 'manage_team', 'view_contracts'],
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
      'manage_contract_templates','generate_contracts','view_contracts',
    ],
  },
  {
    email: 'juridique@bci.sn',
    name: 'Rokhaya Diop',
    role: 'DIRECTION_JURIDIQUE',
    jobTitle: 'Directrice Juridique',
    department: 'Direction Générale',
    branch: 'DKR-SG',
    permissions: ['view_applications', 'view_all', 'approve_applications', 'application_review', 'analytics', 'manage_contract_templates', 'generate_contracts', 'view_contracts'],
  },
  {
    email: 'backoffice@bci.sn',
    name: 'Cheikh Fall',
    role: 'BACK_OFFICE',
    jobTitle: 'Chargé Back-Office',
    department: 'Opérations et Back-office',
    branch: 'DKR-SG',
    permissions: ['view_applications', 'view_branch', 'application_review', 'view_contracts'],
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

  // ── 3. Clients de démonstration (RESET : suppression + recréation) ──────────
  console.log('\n── Clients (reset) ──');
  const adminUser = createdUsers.find(u => u.email === 'admin@bci.sn') || createdUsers[0];
  const deleted = await prisma.client.deleteMany({ where: { companyId: bci.id } });
  console.log(`  Supprimés : ${deleted.count} client(s) + demandes en cascade`);
  const createdClients = [];
  for (const c of TEST_CLIENTS) {
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
  }

  // ── 4. Limites d'approbation BCI ───────────────────────────────────────────
  console.log('\n── Limites d\'approbation ──');
  const approvalLimits = [
    { role: 'CHARGE_AFFAIRES',         displayName: "Chargé d'Affaires",       minAmount: 0,          maxAmount: 5_000_000,    order: 1, reviewDuration: 1440 },
    { role: 'RESPONSABLE_ENGAGEMENTS', displayName: 'Responsable Engagements', minAmount: 5_000_001,  maxAmount: 50_000_000,   order: 2, reviewDuration: 2880 },
    { role: 'COMITE_CREDIT',           displayName: 'Comité de Crédit',        minAmount: 50_000_001, maxAmount: 2_000_000_000, order: 3, reviewDuration: 4320 },
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

  // ── 6. Mur Chinois + RACI (A/C/I) pour la politique active BCI ─────────────

  // 6a. Mur chinois
  const chineseWallRules = [
    { blockedRole: 'ANALYSTE_RISQUES', forbiddenStep: 'mise_en_place_sib',           reason: 'Mur chinois BCEAO — Direction Risques interdite sur opérations SIB' },
    { blockedRole: 'ANALYSTE_RISQUES', forbiddenStep: 'saisie_garanties',            reason: 'Mur chinois BCEAO — Direction Risques interdite sur opérations SIB' },
    { blockedRole: 'ANALYSTE_RISQUES', forbiddenStep: 'tirage_fonds',                reason: 'Mur chinois BCEAO — Direction Risques interdite sur décaissement' },
    { blockedRole: 'ANALYSTE_RISQUES', forbiddenStep: 'back_office_setup',           reason: 'Mur chinois BCEAO — Direction Risques interdite sur opérations BO' },
    { blockedRole: 'ANALYSTE_RISQUES', forbiddenStep: 'charge_affaires_dispatch',    reason: 'Mur chinois BCEAO — Direction Risques interdite sur Front Office' },
    { blockedRole: 'ANALYSTE_RISQUES', forbiddenStep: 'verification_completude',     reason: 'Mur chinois BCEAO — Direction Risques interdite sur Engagements' },
    { blockedRole: 'RESPONSABLE_RISQUES', forbiddenStep: 'mise_en_place_sib',        reason: 'Mur chinois BCEAO — Direction Risques interdite sur opérations SIB' },
    { blockedRole: 'RESPONSABLE_RISQUES', forbiddenStep: 'saisie_garanties',         reason: 'Mur chinois BCEAO — Direction Risques interdite sur opérations SIB' },
    { blockedRole: 'RESPONSABLE_RISQUES', forbiddenStep: 'tirage_fonds',             reason: 'Mur chinois BCEAO — Direction Risques interdite sur décaissement' },
    { blockedRole: 'RESPONSABLE_RISQUES', forbiddenStep: 'back_office_setup',        reason: 'Mur chinois BCEAO — Direction Risques interdite sur opérations BO' },
    { blockedRole: 'RESPONSABLE_RISQUES', forbiddenStep: 'charge_affaires_dispatch', reason: 'Mur chinois BCEAO — Direction Risques interdite sur Front Office' },
    { blockedRole: 'RESPONSABLE_RISQUES', forbiddenStep: 'verification_completude',  reason: 'Mur chinois BCEAO — Direction Risques interdite sur Engagements' },
    { blockedRole: 'RESPONSABLE_ENGAGEMENTS', forbiddenStep: 'contre_analyse',            reason: 'Mur chinois BCEAO — Engagements interdit sur analyse risques' },
    { blockedRole: 'RESPONSABLE_ENGAGEMENTS', forbiddenStep: 'calcul_ratios_prudentiels', reason: 'Mur chinois BCEAO — Engagements interdit sur analyse risques' },
    { blockedRole: 'RESPONSABLE_ENGAGEMENTS', forbiddenStep: 'notation_interne',          reason: 'Mur chinois BCEAO — Engagements interdit sur notation interne' },
    { blockedRole: 'RESPONSABLE_ENGAGEMENTS', forbiddenStep: 'avis_risques',              reason: 'Mur chinois BCEAO — Engagements interdit sur avis risques' },
  ];

  for (const rule of chineseWallRules) {
    const existing = await prisma.tenantChineseWallRule.findFirst({
      where: { companyId: bci.id, blockedRole: rule.blockedRole, forbiddenStep: rule.forbiddenStep },
    });
    if (!existing) {
      await prisma.tenantChineseWallRule.create({ data: { ...rule, companyId: bci.id } });
    }
  }
  console.log(`  ✓ Mur chinois : ${chineseWallRules.length} règles`);

  // 6b. Récupérer la politique active BCI
  const activePolicy = await prisma.creditPolicy.findFirst({
    where: { companyId: bci.id, isActive: true },
    include: { steps: { orderBy: { order: 'asc' } } },
  });

  if (activePolicy) {
    // 6c. Ajouter les phases aux étapes existantes
    const phaseMap = {
      'charge_affaires_dispatch':  'Montage dossier',
      'verification_completude':   'Montage dossier',
      'application_created':       'Montage dossier',
      'contre_analyse':            'Analyse risques',
      'calcul_ratios_prudentiels': 'Analyse risques',
      'notation_interne':          'Analyse risques',
      'avis_risques':              'Analyse risques',
      'validation_comite':         'Approbation',
      'decision_direction':        'Approbation',
      'mise_en_place_sib':         'Mise en place',
      'formalisation_garanties':   'Mise en place',
      'saisie_garanties':          'Mise en place',
      'tirage_fonds':              'Mise en place',
      'back_office_setup':         'Mise en place',
    };

    for (const step of activePolicy.steps) {
      if (phaseMap[step.stepName] && !step.phase) {
        await prisma.creditPolicyStep.update({
          where: { id: step.id },
          data: { phase: phaseMap[step.stepName] },
        });
      }
    }

    // 6d. Ajouter les étapes manquantes si absentes
    const stepNames = activePolicy.steps.map(s => s.stepName);
    const maxOrder = Math.max(...activePolicy.steps.map(s => s.order), 0);

    if (!stepNames.includes('application_created')) {
      await prisma.creditPolicyStep.create({
        data: {
          policyId: activePolicy.id,
          stepName: 'application_created',
          stepLabel: 'Création du dossier',
          phase: 'Montage dossier',
          order: 0,
          stepType: 'CREATION',
          assignedRole: 'CHARGE_AFFAIRES',
          expectedDurationHours: 1,
          maxDurationHours: 4,
          isRequired: true,
        },
      });
      console.log('  Créé : étape application_created');
    }

    if (!stepNames.includes('back_office_setup')) {
      await prisma.creditPolicyStep.create({
        data: {
          policyId: activePolicy.id,
          stepName: 'back_office_setup',
          stepLabel: 'Configuration Back Office',
          phase: 'Mise en place',
          order: maxOrder + 1,
          stepType: 'DISPATCH',
          assignedRole: 'BACK_OFFICE',
          expectedDurationHours: 4,
          maxDurationHours: 24,
          isRequired: true,
        },
      });
      console.log('  Créé : étape back_office_setup');
    }

    // 6e. Recharger les étapes avec les nouvelles
    const allSteps = await prisma.creditPolicyStep.findMany({
      where: { policyId: activePolicy.id, isActive: true },
    });
    const stepByName = Object.fromEntries(allSteps.map(s => [s.stepName, s]));

    // 6f. Insérer les rôles A/C/I par étape
    const raciAssignments = [
      { step: 'application_created',       role: 'RESPONSABLE_ENGAGEMENTS', code: 'I' },
      { step: 'application_created',       role: 'RESPONSABLE_RISQUES',     code: 'I' },
      { step: 'charge_affaires_dispatch',  role: 'RESPONSABLE_ENGAGEMENTS', code: 'I' },
      { step: 'charge_affaires_dispatch',  role: 'RESPONSABLE_RISQUES',     code: 'I' },
      { step: 'verification_completude',   role: 'CHARGE_AFFAIRES',         code: 'C' },
      { step: 'verification_completude',   role: 'RESPONSABLE_RISQUES',     code: 'I' },
      { step: 'contre_analyse',            role: 'RESPONSABLE_RISQUES',     code: 'A' },
      { step: 'contre_analyse',            role: 'RESPONSABLE_ENGAGEMENTS', code: 'I' },
      { step: 'contre_analyse',            role: 'CHARGE_AFFAIRES',         code: 'I' },
      { step: 'calcul_ratios_prudentiels', role: 'RESPONSABLE_RISQUES',     code: 'A' },
      { step: 'notation_interne',          role: 'RESPONSABLE_RISQUES',     code: 'A' },
      { step: 'avis_risques',              role: 'ANALYSTE_RISQUES',        code: 'C' },
      { step: 'avis_risques',              role: 'RESPONSABLE_ENGAGEMENTS', code: 'I' },
      { step: 'avis_risques',              role: 'COMITE_CREDIT',           code: 'I' },
      { step: 'validation_comite',         role: 'RESPONSABLE_RISQUES',     code: 'C' },
      { step: 'validation_comite',         role: 'RESPONSABLE_ENGAGEMENTS', code: 'C' },
      { step: 'validation_comite',         role: 'DIRECTION_GENERALE',      code: 'I' },
      { step: 'decision_direction',        role: 'COMITE_CREDIT',           code: 'C' },
      { step: 'decision_direction',        role: 'RESPONSABLE_RISQUES',     code: 'I' },
      { step: 'decision_direction',        role: 'RESPONSABLE_ENGAGEMENTS', code: 'I' },
      { step: 'mise_en_place_sib',         role: 'BACK_OFFICE',             code: 'R' },
      { step: 'mise_en_place_sib',         role: 'RESPONSABLE_RISQUES',     code: 'I' },
      { step: 'mise_en_place_sib',         role: 'CHARGE_AFFAIRES',         code: 'I' },
      { step: 'formalisation_garanties',   role: 'RESPONSABLE_ENGAGEMENTS', code: 'C' },
      { step: 'formalisation_garanties',   role: 'CHARGE_AFFAIRES',         code: 'I' },
      { step: 'saisie_garanties',          role: 'RESPONSABLE_ENGAGEMENTS', code: 'A' },
      { step: 'saisie_garanties',          role: 'DIRECTION_JURIDIQUE',     code: 'C' },
      { step: 'tirage_fonds',              role: 'RESPONSABLE_ENGAGEMENTS', code: 'A' },
      { step: 'tirage_fonds',              role: 'CHARGE_AFFAIRES',         code: 'C' },
      { step: 'tirage_fonds',              role: 'DIRECTION_GENERALE',      code: 'I' },
      { step: 'back_office_setup',         role: 'RESPONSABLE_ENGAGEMENTS', code: 'I' },
    ];

    for (const a of raciAssignments) {
      const step = stepByName[a.step];
      if (!step) continue;
      const existing = await prisma.creditPolicyStepRole.findFirst({
        where: { policyStepId: step.id, role: a.role },
      });
      if (!existing) {
        await prisma.creditPolicyStepRole.create({
          data: { policyStepId: step.id, role: a.role, raciCode: a.code },
        });
      }
    }
    console.log(`  ✓ RACI A/C/I : ${raciAssignments.length} entrées traitées`);
  } else {
    // Créer la politique BCI par défaut avec toutes les étapes
    console.log('  ↳ Création de la politique BCI par défaut...');
    const defaultSteps = [
      { stepName: 'application_created',       stepLabel: 'Création du dossier',              order: 0,  stepType: 'CREATION',  assignedRole: 'CHARGE_AFFAIRES',         phase: 'Montage dossier',  expectedDurationHours: 24,  maxDurationHours: 72,  allowedActions: ['approve', 'transfer'] },
      { stepName: 'charge_affaires_dispatch',  stepLabel: 'Traitement par le CA',              order: 1,  stepType: 'DISPATCH',  assignedRole: 'CHARGE_AFFAIRES',         phase: 'Montage dossier',  expectedDurationHours: 48,  maxDurationHours: 120, allowedActions: ['approve', 'transfer'] },
      { stepName: 'verification_completude',   stepLabel: 'Vérification de la complétude',    order: 2,  stepType: 'ANALYSIS',  assignedRole: 'CHARGE_AFFAIRES',         phase: 'Montage dossier',  expectedDurationHours: 24,  maxDurationHours: 48,  allowedActions: ['approve', 'request_info'] },
      { stepName: 'contre_analyse',            stepLabel: 'Contre-analyse',                   order: 3,  stepType: 'ANALYSIS',  assignedRole: 'ANALYSTE_RISQUES',        phase: 'Analyse risques',  expectedDurationHours: 48,  maxDurationHours: 120, allowedActions: ['approve', 'request_info'] },
      { stepName: 'calcul_ratios_prudentiels', stepLabel: 'Calcul des ratios prudentiels',    order: 4,  stepType: 'ANALYSIS',  assignedRole: 'ANALYSTE_RISQUES',        phase: 'Analyse risques',  expectedDurationHours: 24,  maxDurationHours: 72,  allowedActions: ['approve', 'request_info'] },
      { stepName: 'notation_interne',          stepLabel: 'Notation interne',                 order: 5,  stepType: 'ANALYSIS',  assignedRole: 'ANALYSTE_RISQUES',        phase: 'Analyse risques',  expectedDurationHours: 24,  maxDurationHours: 72,  allowedActions: ['approve', 'request_info'] },
      { stepName: 'avis_risques',              stepLabel: 'Avis risques',                     order: 6,  stepType: 'APPROVAL',  assignedRole: 'RESPONSABLE_RISQUES',     phase: 'Analyse risques',  expectedDurationHours: 24,  maxDurationHours: 72,  allowedActions: ['approve', 'reject', 'request_info'] },
      { stepName: 'validation_comite',         stepLabel: 'Validation comité de crédit',      order: 7,  stepType: 'COMMITTEE', assignedRole: 'COMITE_CREDIT',           phase: 'Approbation',      expectedDurationHours: 48,  maxDurationHours: 120, allowedActions: ['approve', 'reject', 'request_info'] },
      { stepName: 'decision_direction',        stepLabel: 'Décision direction générale',      order: 8,  stepType: 'APPROVAL',  assignedRole: 'DIRECTION_GENERALE',      phase: 'Approbation',      expectedDurationHours: 48,  maxDurationHours: 120, allowedActions: ['approve', 'reject', 'request_info'] },
      { stepName: 'mise_en_place_sib',         stepLabel: 'Mise en place SIB',                order: 9,  stepType: 'DISPATCH',  assignedRole: 'RESPONSABLE_ENGAGEMENTS', phase: 'Mise en place',    expectedDurationHours: 48,  maxDurationHours: 120, allowedActions: ['approve', 'transfer'] },
      { stepName: 'formalisation_garanties',   stepLabel: 'Formalisation des garanties',      order: 10, stepType: 'LEGAL',     assignedRole: 'DIRECTION_JURIDIQUE',     phase: 'Mise en place',    expectedDurationHours: 48,  maxDurationHours: 120, allowedActions: ['approve', 'transfer'] },
      { stepName: 'saisie_garanties',          stepLabel: 'Saisie des garanties',             order: 11, stepType: 'LEGAL',     assignedRole: 'DIRECTION_JURIDIQUE',     phase: 'Mise en place',    expectedDurationHours: 24,  maxDurationHours: 72,  allowedActions: ['approve', 'transfer'] },
      { stepName: 'tirage_fonds',              stepLabel: 'Tirage des fonds',                 order: 12, stepType: 'DISPATCH',  assignedRole: 'BACK_OFFICE',             phase: 'Mise en place',    expectedDurationHours: 24,  maxDurationHours: 48,  allowedActions: ['approve', 'transfer'] },
      { stepName: 'back_office_setup',         stepLabel: 'Mise en place back-office',        order: 13, stepType: 'DISPATCH',  assignedRole: 'BACK_OFFICE',             phase: 'Mise en place',    expectedDurationHours: 24,  maxDurationHours: 48,  allowedActions: ['approve', 'transfer'] },
    ];
    const created = await prisma.creditPolicy.create({
      data: {
        name:      'Politique Générale BCI',
        code:      'POL-BCI-2024',
        isActive:  true,
        companyId: bci.id,
        steps: { create: defaultSteps.map(s => ({ ...s, isRequired: true, creditTypeIds: [] })) },
      },
    });
    console.log(`  ✓ Politique BCI créée : ${created.name} (${defaultSteps.length} étapes)`);
    console.log('  ℹ Relancez le seed pour peupler les RACI A/C/I');
  }

  console.log('✓ Mur chinois BCI + RACI A/C/I');

  // ── 7. Infrastructure de notifications ────────────────────────────────────
  console.log('\n── Notifications ──');

  // 7a. Canal EMAIL (inactif par défaut — les notifications in-app fonctionnent sans SMTP configuré)
  let emailChannel = await prisma.notificationChannel.findUnique({ where: { type: 'EMAIL' } });
  if (!emailChannel) {
    emailChannel = await prisma.notificationChannel.create({
      data: {
        type: 'EMAIL',
        name: 'Email (à configurer)',
        isActive: false,
        config: { host: 'smtp.example.com', port: 587, secure: false, user: '', pass: '', fromName: 'OptimusCredit', fromEmail: 'noreply@optimuscredit.sn' },
      },
    });
    console.log('  Créé : canal EMAIL (inactif — configurez le SMTP dans les paramètres)');
  } else {
    console.log('  Existant : canal EMAIL');
  }

  // 7b. Templates de notification (in-app via canal EMAIL)
  const notifTemplates = [
    {
      name: 'Nouveau dossier soumis',
      event: 'APPLICATION_SUBMITTED',
      subject: 'Nouveau dossier — {{clientName}} ({{applicationNumber}})',
      body: 'Un nouveau dossier de crédit a été soumis pour {{clientName}} — {{applicationNumber}} — Montant : {{amount}} {{currency}}. Soumis par {{createdByName}}.',
    },
    {
      name: 'Étape assignée',
      event: 'STEP_ASSIGNED',
      subject: 'Action requise — Dossier {{clientName}} ({{applicationNumber}})',
      body: 'L\'étape "{{stepName}}" vous a été assignée pour le dossier {{clientName}} ({{applicationNumber}}) — Montant : {{amount}} {{currency}}.',
    },
    {
      name: 'Étape approuvée',
      event: 'STEP_APPROVED',
      subject: 'Étape validée — {{clientName}} ({{applicationNumber}})',
      body: 'L\'étape "{{stepName}}" du dossier {{clientName}} ({{applicationNumber}}) a été validée.',
    },
    {
      name: 'Étape rejetée',
      event: 'STEP_REJECTED',
      subject: 'Étape rejetée — {{clientName}} ({{applicationNumber}})',
      body: 'L\'étape "{{stepName}}" du dossier {{clientName}} ({{applicationNumber}}) a été rejetée. Commentaires : {{comments}}',
    },
    {
      name: 'Dossier approuvé',
      event: 'APPLICATION_APPROVED',
      subject: 'Dossier approuvé — {{clientName}} ({{applicationNumber}})',
      body: 'Le dossier de crédit {{clientName}} ({{applicationNumber}}) d\'un montant de {{amount}} {{currency}} a été approuvé.',
    },
    {
      name: 'Dossier rejeté',
      event: 'APPLICATION_REJECTED',
      subject: 'Dossier rejeté — {{clientName}} ({{applicationNumber}})',
      body: 'Le dossier de crédit {{clientName}} ({{applicationNumber}}) a été rejeté. Commentaires : {{comments}}',
    },
  ];

  const templateByEvent = {};
  for (const tpl of notifTemplates) {
    const existing = await prisma.notificationTemplate.findFirst({
      where: { event: tpl.event, channelId: emailChannel.id },
    });
    if (!existing) {
      const created = await prisma.notificationTemplate.create({
        data: { ...tpl, channelId: emailChannel.id, isActive: true },
      });
      templateByEvent[tpl.event] = created;
      console.log(`  Créé : template ${tpl.event}`);
    } else {
      templateByEvent[tpl.event] = existing;
      console.log(`  Existant : template ${tpl.event}`);
    }
  }

  // 7c. Règles de notification (qui reçoit quoi)
  const ALL_WORKFLOW_ROLES = ['CHARGE_AFFAIRES', 'ANALYSTE_RISQUES', 'RESPONSABLE_RISQUES', 'RESPONSABLE_ENGAGEMENTS', 'COMITE_CREDIT', 'DIRECTION_GENERALE', 'DIRECTION_JURIDIQUE', 'BACK_OFFICE'];
  const notifRules = [
    { event: 'APPLICATION_SUBMITTED', recipientRoles: ['RESPONSABLE_ENGAGEMENTS', 'ANALYSTE_RISQUES', 'RESPONSABLE_RISQUES', 'CHARGE_AFFAIRES'] },
    { event: 'STEP_ASSIGNED',         recipientRoles: ALL_WORKFLOW_ROLES },
    { event: 'STEP_APPROVED',         recipientRoles: ['CHARGE_AFFAIRES', 'RESPONSABLE_ENGAGEMENTS', 'RESPONSABLE_RISQUES'] },
    { event: 'STEP_REJECTED',         recipientRoles: ['CHARGE_AFFAIRES', 'RESPONSABLE_ENGAGEMENTS', 'RESPONSABLE_RISQUES'] },
    { event: 'APPLICATION_APPROVED',  recipientRoles: ['CHARGE_AFFAIRES', 'RESPONSABLE_ENGAGEMENTS', 'DIRECTION_GENERALE'] },
    { event: 'APPLICATION_REJECTED',  recipientRoles: ['CHARGE_AFFAIRES', 'RESPONSABLE_ENGAGEMENTS'] },
  ];

  let rulesCreated = 0;
  for (const rule of notifRules) {
    const tpl = templateByEvent[rule.event];
    if (!tpl) continue;
    const existing = await prisma.notificationRule.findUnique({
      where: { event_templateId: { event: rule.event, templateId: tpl.id } },
    });
    if (!existing) {
      await prisma.notificationRule.create({
        data: { event: rule.event, templateId: tpl.id, recipientRoles: rule.recipientRoles, isActive: true },
      });
      rulesCreated++;
    }
  }
  console.log(`  ✓ Règles : ${rulesCreated} créées / ${notifRules.length - rulesCreated} existantes`);

  // ── 8. Résumé ──────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`✓ ${TEST_USERS.length} utilisateurs (upsert)`);
  console.log(`✓ ${createdClients.length} clients`);
  console.log(`✓ Mot de passe commun : ${PASSWORD}`);
  console.log('✓ Mur Chinois + RACI');
  console.log('✓ Notifications : canal + templates + règles');
  console.log('\nComptes disponibles :');
  console.log('  superadmin@optimuscredit.sn  SuperAdmin2024!  (SUPER_ADMIN plateforme)');
  for (const u of TEST_USERS) {
    console.log(`  ${u.email.padEnd(30)} ${PASSWORD}  (${u.role})`);
  }
}

main()
  .catch(e => { console.error('❌', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
