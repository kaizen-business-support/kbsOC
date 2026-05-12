/**
 * seed-demo-client.js — Insérer un client démo riche pour tester la fiche client
 *
 * Usage : node prisma/seed-demo-client.js
 *
 * Crée :
 *  - 1 client  : Groupe Sénégal Agro-Industries SA (avec numéro de compte)
 *  - 3 dossiers à des stades différents :
 *      • Crédit Moyen Terme 45 000 000 XOF — DISBURSED (décaissé) → échéancier visible
 *      • Crédit Long Terme  120 000 000 XOF — UNDER_REVIEW (en instruction)
 *      • Crédit Court Terme  8 000 000 XOF — APPROVED (approuvé) → échéancier visible
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BCI_ID    = 'cmo960ykh0000olvszxggdcj4';
const CA1_ID    = 'cmo96i8600000olrxk0ns33iv';   // Amadou Diallo
const ANA_ID    = 'cmo96i86q0006olrxd9s86x2g';   // Moussa Traoré (analyste)
const RESP_ID   = 'cmo96i86s0009olrx73vbrxlh';   // Aïssatou Ndiaye (resp. risques)

const CT_CMT    = 'ct-moyen-terme';
const CT_CLT    = 'ct-long-terme';
const CT_CT     = 'ct-court-terme';

async function main() {
  console.log('═══ Seed client démo ════════════════════════════════════════');

  // ── 1. Client ──────────────────────────────────────────────────────────────
  const existing = await prisma.client.findFirst({
    where: { companyId: BCI_ID, rccm: 'SN-DKR-2014-B-11223' },
  });
  if (existing) {
    console.log(`⚠  Client déjà présent (id: ${existing.id}) — suppression pour recréation propre`);
    // Supprime les applications en cascade puis le client
    await prisma.creditApplication.deleteMany({ where: { clientId: existing.id } });
    await prisma.client.delete({ where: { id: existing.id } });
  }

  const client = await prisma.client.create({
    data: {
      accountNumber:   'CLT-2026-119043',
      companyName:     'Groupe Sénégal Agro-Industries SA',
      rccm:            'SN-DKR-2014-B-11223',
      ninea:           '001122334',
      legalForm:       'SA',
      sector:          'Agriculture et Agrobusiness',
      branch:          'Dakar Plateau',
      headquarters:    'Dakar, Plateau — Avenue Léopold Sédar Senghor',
      contactPerson:   'Mamadou Seck',
      phone:           '+221 33 842 15 78',
      email:           'direction@gsai.sn',
      establishedYear: 2014,
      isActive:        true,
      companyId:       BCI_ID,
      createdBy:       CA1_ID,
      createdAt:       new Date('2022-03-15T09:00:00Z'),
    },
  });
  console.log(`✓ Client créé : ${client.companyName} [${client.accountNumber}]`);

  // ── 2. Dossier 1 : DISBURSED — CMT 45 000 000 XOF / 36 mois / 10.5% mensuel ─
  const app1 = await prisma.creditApplication.create({
    data: {
      applicationNumber: 'APP-2023-00147',
      clientId:    client.id,
      companyId:   BCI_ID,
      createdBy:   CA1_ID,
      creditTypeId: CT_CMT,
      amount:       45_000_000,
      currency:     'XOF',
      purpose:      'Acquisition de matériel agricole et modernisation des installations de stockage',
      durationMonths: 36,
      proposedRate:   10.5,
      repaymentSchedule: 'MONTHLY',
      collateralType:  'Nantissement matériel',
      collateralValue: 60_000_000,
      status:      'DISBURSED',
      submittedAt: new Date('2023-02-10T10:00:00Z'),
      createdAt:   new Date('2023-02-10T10:00:00Z'),
      workflowSteps: {
        create: [
          { stepName: 'SUBMISSION',    role: 'CHARGE_AFFAIRES',         status: 'COMPLETED', assigneeId: CA1_ID,   completedAt: new Date('2023-02-10T11:00:00Z'), createdAt: new Date('2023-02-10T10:00:00Z') },
          { stepName: 'ANALYSIS',      role: 'ANALYSTE_RISQUES',        status: 'COMPLETED', assigneeId: ANA_ID,   completedAt: new Date('2023-02-17T14:30:00Z'), createdAt: new Date('2023-02-11T08:00:00Z') },
          { stepName: 'REVIEW',        role: 'RESPONSABLE_RISQUES',     status: 'COMPLETED', assigneeId: RESP_ID,  completedAt: new Date('2023-02-22T10:00:00Z'), createdAt: new Date('2023-02-18T08:00:00Z') },
          { stepName: 'APPROVAL',      role: 'RESPONSABLE_ENGAGEMENTS', status: 'COMPLETED',                       completedAt: new Date('2023-02-28T16:00:00Z'), createdAt: new Date('2023-02-23T08:00:00Z') },
          { stepName: 'DISBURSEMENT',  role: 'BACK_OFFICE',             status: 'COMPLETED',                       completedAt: new Date('2023-03-05T11:00:00Z'), createdAt: new Date('2023-03-01T08:00:00Z') },
        ],
      },
    },
  });
  console.log(`  ✓ Dossier 1 : ${app1.applicationNumber} — DISBURSED`);

  // ── 3. Dossier 2 : UNDER_REVIEW — CLT 120 000 000 XOF / 84 mois / 11% trimestriel ─
  const app2 = await prisma.creditApplication.create({
    data: {
      applicationNumber: 'APP-2025-00892',
      clientId:    client.id,
      companyId:   BCI_ID,
      createdBy:   CA1_ID,
      creditTypeId: CT_CLT,
      amount:       120_000_000,
      currency:     'XOF',
      purpose:      'Construction et équipement d\'une unité de transformation agroalimentaire — Phase 2',
      durationMonths: 84,
      proposedRate:   11.0,
      repaymentSchedule: 'QUARTERLY',
      collateralType:  'Hypothèque immobilière',
      collateralValue: 180_000_000,
      status:       'UNDER_REVIEW',
      submittedAt:  new Date('2025-11-05T09:00:00Z'),
      createdAt:    new Date('2025-11-01T09:00:00Z'),
      workflowSteps: {
        create: [
          { stepName: 'SUBMISSION', role: 'CHARGE_AFFAIRES',     status: 'COMPLETED',  assigneeId: CA1_ID, completedAt: new Date('2025-11-05T10:00:00Z'), createdAt: new Date('2025-11-01T09:00:00Z') },
          { stepName: 'ANALYSIS',   role: 'ANALYSTE_RISQUES',    status: 'IN_REVIEW',  assigneeId: ANA_ID,                                                  createdAt: new Date('2025-11-06T08:00:00Z') },
          { stepName: 'REVIEW',     role: 'RESPONSABLE_RISQUES', status: 'PENDING',                                                                         createdAt: new Date('2025-11-06T08:01:00Z') },
        ],
      },
    },
  });
  console.log(`  ✓ Dossier 2 : ${app2.applicationNumber} — UNDER_REVIEW`);

  // ── 4. Dossier 3 : APPROVED — CT 8 000 000 XOF / 12 mois / 9.5% mensuel ─
  const app3 = await prisma.creditApplication.create({
    data: {
      applicationNumber: 'APP-2026-00041',
      clientId:    client.id,
      companyId:   BCI_ID,
      createdBy:   CA1_ID,
      creditTypeId: CT_CT,
      amount:       8_000_000,
      currency:     'XOF',
      purpose:      'Financement du fonds de roulement — campagne agricole 2026',
      durationMonths: 12,
      proposedRate:   9.5,
      repaymentSchedule: 'MONTHLY',
      status:       'APPROVED',
      submittedAt:  new Date('2026-01-15T10:00:00Z'),
      createdAt:    new Date('2026-01-14T10:00:00Z'),
      workflowSteps: {
        create: [
          { stepName: 'SUBMISSION', role: 'CHARGE_AFFAIRES',         status: 'COMPLETED', assigneeId: CA1_ID,  completedAt: new Date('2026-01-15T11:00:00Z'), createdAt: new Date('2026-01-14T10:00:00Z') },
          { stepName: 'ANALYSIS',   role: 'ANALYSTE_RISQUES',        status: 'COMPLETED', assigneeId: ANA_ID,  completedAt: new Date('2026-01-20T15:00:00Z'), createdAt: new Date('2026-01-16T08:00:00Z') },
          { stepName: 'APPROVAL',   role: 'RESPONSABLE_ENGAGEMENTS', status: 'COMPLETED',                      completedAt: new Date('2026-01-25T10:00:00Z'), createdAt: new Date('2026-01-21T08:00:00Z') },
        ],
      },
    },
  });
  console.log(`  ✓ Dossier 3 : ${app3.applicationNumber} — APPROVED`);

  console.log('\n✅ Client démo créé avec succès.');
  console.log('   Connectez-vous avec ca1@bci.sn / Demo2024! pour le voir dans la liste clients.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
