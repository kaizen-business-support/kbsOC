/**
 * seed-juridique-demo.js
 * Crée un dossier de démo positionné sur l'étape juridique
 * + un modèle de contrat de prêt standard
 * Usage : node prisma/seed-juridique-demo.js
 */
const path = require('path');
process.chdir(path.join(__dirname, '..'));

const { PrismaClient } = require('@prisma/client');
const PizZip = require('pizzip');
const fs = require('fs');
const p = new PrismaClient();

// ── Contenu du template DOCX ─────────────────────────────────────────────────
function createDemoDocx(outPath) {
  const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
  const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  const wordRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';

  const para = (text) => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${ns}"><w:body>
${para('CONTRAT DE PRET')}
${para('Date : {meta.generatedAt}')}
${para('')}
${para('ENTRE :')}
${para('LA BANQUE : {bank.name}, siege : {bank.headquarters}, represente par {bank.legalRepresentative}')}
${para('')}
${para('ET :')}
${para('L EMPRUNTEUR : {client.companyName} ({client.legalForm}), RCCM {client.rccm}, NINEA {client.ninea}')}
${para('Siege : {client.headquarters} | Contact : {client.contactPerson} | Tel : {client.phone}')}
${para('')}
${para('Article 1 - OBJET')}
${para('Credit de type {meta.creditType} — Montant : {application.amount} {application.currency}')}
${para('En lettres : {application.amountInWords}')}
${para('Objet : {application.purpose}')}
${para('')}
${para('Article 2 - CONDITIONS')}
${para('Duree : {application.durationMonths} mois')}
${para('Taux : {application.proposedRate} %')}
${para('Remboursement : {application.repaymentSchedule}')}
${para('')}
${para('Article 3 - GARANTIES')}
${para('Type : {application.collateralType}')}
${para('Valeur : {application.collateralValue} {application.currency}')}
${para('')}
${para('Reference dossier : {application.applicationNumber}')}
${para('')}
${para('Fait a ___________________, le {meta.generatedAt}')}
${para('')}
${para('Pour la Banque :                    Pour l Emprunteur :')}
${para('___________________________         ___________________________')}
${para('{bank.legalRepresentative}          {client.contactPerson}')}
<w:sectPr/></w:body></w:document>`;

  const zip = new PizZip();
  zip.file('[Content_Types].xml', ct);
  zip.folder('_rels').file('.rels', rels);
  zip.folder('word').folder('_rels').file('document.xml.rels', wordRels);
  zip.folder('word').file('document.xml', doc);
  const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buf);
  return buf.length;
}

async function main() {
  console.log('=== Seed juridique démo ===');

  // Données de base
  const company = await p.company.findFirst();
  if (!company) { console.error('Aucune compagnie — lancez seed-bci.js d abord'); process.exit(1); }

  const [ca, analyst, respRisques, engagements, juridique, client] = await Promise.all([
    p.user.findFirst({ where: { role: 'CHARGE_AFFAIRES' } }),
    p.user.findFirst({ where: { role: 'ANALYSTE_RISQUES' } }),
    p.user.findFirst({ where: { role: 'RESPONSABLE_RISQUES' } }),
    p.user.findFirst({ where: { role: 'RESPONSABLE_ENGAGEMENTS' } }),
    p.user.findFirst({ where: { role: 'DIRECTION_JURIDIQUE' } }),
    p.client.findFirst(),
  ]);

  const missing = [['CHARGE_AFFAIRES',ca],['ANALYSTE_RISQUES',analyst],['RESPONSABLE_RISQUES',respRisques],['RESPONSABLE_ENGAGEMENTS',engagements],['DIRECTION_JURIDIQUE',juridique]]
    .filter(([, u]) => !u).map(([r]) => r);
  if (missing.length) { console.error('Utilisateurs manquants:', missing.join(', ')); process.exit(1); }

  const creditType = await p.creditType.findFirst();
  if (!creditType) { console.error('Aucun type de crédit'); process.exit(1); }

  // ── 1. Template de contrat ──────────────────────────────────────────────────
  const templateName = 'Contrat de Prêt — Modèle Standard';
  const existingTemplate = await p.contractTemplate.findFirst({ where: { name: templateName, companyId: company.id } });

  if (existingTemplate) {
    console.log('✓ Template déjà présent:', existingTemplate.id);
  } else {
    const docxPath = path.join(__dirname, '../uploads/contract-templates/contrat-pret-standard.docx');
    const size = createDemoDocx(docxPath);
    const tpl = await p.contractTemplate.create({
      data: {
        name: templateName,
        originalName: 'contrat-pret-standard.docx',
        documentType: 'CONTRACT_LOAN',
        description: 'Modèle standard avec toutes les variables du catalogue',
        fileFormat: 'DOCX',
        filePath: docxPath,
        fileSize: size,
        creditTypeIds: [],
        isActive: true,
        companyId: company.id,
        createdBy: juridique.id,
        detectedVariables: [
          'meta.generatedAt','meta.creditType',
          'bank.name','bank.headquarters','bank.legalRepresentative',
          'client.companyName','client.legalForm','client.rccm','client.ninea',
          'client.headquarters','client.contactPerson','client.phone',
          'application.amount','application.amountInWords','application.currency',
          'application.purpose','application.durationMonths','application.proposedRate',
          'application.repaymentSchedule','application.collateralType','application.collateralValue',
          'application.applicationNumber',
        ],
        customFields: [],
      },
    });
    console.log('✓ Template créé:', tpl.id);
  }

  // ── 2. Dossier démo à l'étape juridique ────────────────────────────────────
  const appNumber = 'APP-JURIDIQUE-DEMO';
  const existing = await p.creditApplication.findFirst({ where: { applicationNumber: appNumber } });
  if (existing) {
    console.log('✓ Dossier démo déjà présent:', existing.applicationNumber);
    return;
  }

  // Charger la politique active
  const { createWorkflowStepsForApplication } = require('../dist/services/workflowService');

  const app = await p.creditApplication.create({
    data: {
      applicationNumber: appNumber,
      clientId: client.id,
      amount: 35000000,
      currency: 'XOF',
      purpose: 'Financement cycle exploitation — dossier démo étape juridique',
      durationMonths: 18,
      creditTypeId: creditType.id,
      proposedRate: 8.5,
      collateralType: 'Nantissement de fonds de commerce',
      collateralValue: 50000000,
      repaymentSchedule: 'MONTHLY',
      status: 'UNDER_REVIEW',
      submittedAt: new Date(),
      createdBy: ca.id,
      companyId: company.id,
    },
  });

  // Étape création
  await p.workflowStep.create({
    data: { applicationId: app.id, stepName: 'application_created', role: 'CHARGE_AFFAIRES', assigneeId: ca.id, status: 'COMPLETED', completedAt: new Date(), comments: 'Dossier soumis' },
  });

  // Toutes les étapes de la politique
  await createWorkflowStepsForApplication(app.id, creditType.id, 35000000);

  // Approuver les étapes antérieures à l'étape juridique
  const steps = await p.workflowStep.findMany({ where: { applicationId: app.id }, orderBy: { createdAt: 'asc' } });

  const approvers = {
    charge_affaires_dispatch:   ca.id,
    verification_completude:    ca.id,
    contre_analyse:             analyst.id,
    calcul_ratios_prudentiels:  analyst.id,
    notation_interne:           analyst.id,
    avis_risques:               respRisques.id,
    mise_en_place_sib:          engagements.id,
  };

  for (const [stepName, userId] of Object.entries(approvers)) {
    const s = steps.find(s => s.stepName === stepName);
    if (s) await p.workflowStep.update({ where: { id: s.id }, data: { status: 'APPROVED', assigneeId: userId, completedAt: new Date() } });
  }

  const legalSteps = steps.filter(s => ['formalisation_garanties','saisie_garanties'].includes(s.stepName));
  console.log('✓ Dossier créé:', app.applicationNumber, '| étapes LEGAL PENDING:', legalSteps.length);
  console.log('  → Connectez-vous en DIRECTION_JURIDIQUE → page Approbations → bouton "Étape juridique"');
}

main()
  .catch(e => { console.error('ERREUR:', e.message); process.exit(1); })
  .finally(() => p.$disconnect());
