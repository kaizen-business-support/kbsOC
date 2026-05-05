const path = require('path');
process.chdir(path.join(__dirname, '..'));

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

const departments = [
  { name: 'Direction Générale',          code: 'DG',  description: 'Direction générale et gouvernance' },
  { name: 'Crédit et Financement',       code: 'CR',  description: 'Analyse et octroi de crédits' },
  { name: 'Risques et Conformité',       code: 'RC',  description: 'Gestion des risques et conformité réglementaire' },
  { name: 'Commerce et Développement',   code: 'CD',  description: 'Développement commercial et relation clients' },
  { name: 'Opérations et Back-office',   code: 'OP',  description: 'Traitement des opérations bancaires' },
  { name: 'Informatique et Systèmes',    code: 'IT',  description: 'Systèmes d\'information et infrastructure' },
  { name: 'Finance et Comptabilité',     code: 'FC',  description: 'Comptabilité, reporting financier et trésorerie' },
  { name: 'Ressources Humaines',         code: 'RH',  description: 'Gestion du personnel et développement RH' },
  { name: 'Audit Interne',               code: 'AI',  description: 'Contrôle interne et audit' },
];

const branches = [
  { name: 'Siège Social - Dakar',        code: 'DKR-SG', city: 'Dakar',        address: 'Avenue Léopold Sédar Senghor', country: 'Sénégal' },
  { name: 'Agence Plateau',              code: 'DKR-PL', city: 'Dakar',        address: 'Rue du Docteur Thèze, Plateau', country: 'Sénégal' },
  { name: 'Agence Almadies',             code: 'DKR-AL', city: 'Dakar',        address: 'Route des Almadies',            country: 'Sénégal' },
  { name: 'Agence Thiès',                code: 'THS',    city: 'Thiès',        address: 'Avenue Lamine Guèye',           country: 'Sénégal' },
  { name: 'Agence Saint-Louis',          code: 'STL',    city: 'Saint-Louis',  address: 'Rue Blanchot',                  country: 'Sénégal' },
  { name: 'Agence Ziguinchor',           code: 'ZIG',    city: 'Ziguinchor',   address: 'Rue du Commerce',               country: 'Sénégal' },
  { name: 'Agence Kaolack',              code: 'KLK',    city: 'Kaolack',      address: 'Avenue Valdiodio Ndiaye',       country: 'Sénégal' },
];

async function main() {
  console.log('── Seed départements ──');
  for (const dept of departments) {
    const existing = await prisma.department.findUnique({ where: { code: dept.code } });
    if (!existing) {
      await prisma.department.create({ data: dept });
      console.log(`  Créé : ${dept.name}`);
    } else {
      console.log(`  Déjà existant : ${dept.name}`);
    }
  }

  console.log('── Seed agences ──');
  for (const branch of branches) {
    const existing = await prisma.branch.findUnique({ where: { code: branch.code } });
    if (!existing) {
      await prisma.branch.create({ data: branch });
      console.log(`  Créé : ${branch.name}`);
    } else {
      console.log(`  Déjà existant : ${branch.name}`);
    }
  }

  console.log('✓ Terminé');
}

main().catch(console.error).finally(() => prisma.$disconnect());
