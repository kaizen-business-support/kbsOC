// Seed : templates de dashboard globaux (isGlobal = true, companyId = null)
// Idempotent : ne recrée pas si l'ID existe déjà.
// Usage : node backend/prisma/seed-dashboard-templates.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TEMPLATES = [
  {
    id: 'tpl-bci-vue-ensemble',
    name: 'Vue d\'ensemble — Direction',
    description: 'KPIs principaux, évolution mensuelle et taux d\'approbation',
    isGlobal: true,
    widgets: [
      { id: 'w-ve-1', type: 'kpi_card',   title: 'Dossiers reçus',       order: 0, config: { source: 'applications', metric: 'count',               colorScheme: 'blue' } },
      { id: 'w-ve-2', type: 'kpi_card',   title: 'Montant total (XOF)',   order: 1, config: { source: 'applications', metric: 'sum_amount',           colorScheme: 'green' } },
      { id: 'w-ve-3', type: 'kpi_card',   title: "Taux d'approbation",    order: 2, config: { source: 'analytics',    metric: 'approval_rate',        colorScheme: 'orange' } },
      { id: 'w-ve-4', type: 'kpi_card',   title: 'Délai moyen (jours)',   order: 3, config: { source: 'applications', metric: 'avg_processing_time',  colorScheme: 'red' } },
      { id: 'w-ve-5', type: 'bar_chart',  title: 'Dossiers par mois',     order: 4, config: { source: 'applications', metric: 'count',      groupBy: 'month', color: '#1565c0' } },
      { id: 'w-ve-6', type: 'line_chart', title: 'Évolution des montants', order: 5, config: { source: 'applications', metric: 'sum_amount', groupBy: 'month', color: '#2e7d32' } },
      { id: 'w-ve-7', type: 'gauge',      title: "Taux d'approbation",    order: 6, config: { source: 'analytics',    metric: 'approval_rate' } },
    ],
    layout: [
      { i: 'w-ve-1', x: 0, y: 0, w: 3, h: 2 },
      { i: 'w-ve-2', x: 3, y: 0, w: 3, h: 2 },
      { i: 'w-ve-3', x: 6, y: 0, w: 3, h: 2 },
      { i: 'w-ve-4', x: 9, y: 0, w: 3, h: 2 },
      { i: 'w-ve-5', x: 0, y: 2, w: 6, h: 4 },
      { i: 'w-ve-6', x: 6, y: 2, w: 6, h: 4 },
      { i: 'w-ve-7', x: 0, y: 6, w: 4, h: 4 },
    ],
  },
  {
    id: 'tpl-bci-operationnel',
    name: 'Suivi opérationnel',
    description: 'Dossiers par statut, secteurs d\'activité et liste des derniers dossiers',
    isGlobal: true,
    widgets: [
      { id: 'w-op-1', type: 'bar_chart', title: 'Dossiers par statut',     order: 0, config: { source: 'applications', metric: 'count', groupBy: 'status', color: '#1565c0' } },
      { id: 'w-op-2', type: 'bar_chart', title: "Secteurs d'activité",     order: 1, config: { source: 'applications', metric: 'count', groupBy: 'sector', color: '#7b1fa2' } },
      { id: 'w-op-3', type: 'table',     title: 'Derniers dossiers',       order: 2, config: { source: 'applications', metric: 'list',  limit: 10 } },
    ],
    layout: [
      { i: 'w-op-1', x: 0, y: 0, w: 6, h: 4 },
      { i: 'w-op-2', x: 6, y: 0, w: 6, h: 4 },
      { i: 'w-op-3', x: 0, y: 4, w: 12, h: 5 },
    ],
  },
  {
    id: 'tpl-bci-tendances',
    name: 'Tendances & Prévisions',
    description: 'Régressions linéaires sur les dossiers et les montants avec projection 3 mois',
    isGlobal: true,
    widgets: [
      { id: 'w-tr-1', type: 'trend_chart', title: 'Tendance des dossiers',  order: 0, config: { source: 'applications', metric: 'count',      groupBy: 'month', regressionType: 'linear', forecastMonths: 3, color: '#1565c0' } },
      { id: 'w-tr-2', type: 'trend_chart', title: 'Tendance des montants',  order: 1, config: { source: 'applications', metric: 'sum_amount', groupBy: 'month', regressionType: 'linear', forecastMonths: 3, color: '#2e7d32' } },
      { id: 'w-tr-3', type: 'line_chart',  title: 'Évolution sur 12 mois', order: 2, config: { source: 'applications', metric: 'count',      groupBy: 'month', periodOverride: 'last_12_months', color: '#e65100' } },
    ],
    layout: [
      { i: 'w-tr-1', x: 0, y: 0, w: 6, h: 4 },
      { i: 'w-tr-2', x: 6, y: 0, w: 6, h: 4 },
      { i: 'w-tr-3', x: 0, y: 4, w: 12, h: 4 },
    ],
  },
  {
    id: 'tpl-bci-performance',
    name: 'Performance commerciale',
    description: 'Dossiers par agence, par chargé et par type de crédit',
    isGlobal: true,
    widgets: [
      { id: 'w-pc-1', type: 'kpi_card',  title: 'Dossiers reçus',         order: 0, config: { source: 'applications', metric: 'count',      colorScheme: 'blue' } },
      { id: 'w-pc-2', type: 'kpi_card',  title: 'Montant total (XOF)',     order: 1, config: { source: 'applications', metric: 'sum_amount', colorScheme: 'green' } },
      { id: 'w-pc-3', type: 'bar_chart', title: 'Dossiers par agence',     order: 2, config: { source: 'applications', metric: 'count',      groupBy: 'branch',      color: '#1565c0' } },
      { id: 'w-pc-4', type: 'bar_chart', title: 'Dossiers par chargé',     order: 3, config: { source: 'applications', metric: 'count',      groupBy: 'manager',     color: '#7b1fa2' } },
      { id: 'w-pc-5', type: 'bar_chart', title: 'Par type de crédit',      order: 4, config: { source: 'applications', metric: 'count',      groupBy: 'credit_type', color: '#e65100' } },
      { id: 'w-pc-6', type: 'bar_chart', title: 'Montants par agence',     order: 5, config: { source: 'applications', metric: 'sum_amount', groupBy: 'branch',      color: '#2e7d32' } },
    ],
    layout: [
      { i: 'w-pc-1', x: 0, y: 0, w: 3,  h: 2 },
      { i: 'w-pc-2', x: 3, y: 0, w: 3,  h: 2 },
      { i: 'w-pc-3', x: 0, y: 2, w: 6,  h: 4 },
      { i: 'w-pc-4', x: 6, y: 2, w: 6,  h: 4 },
      { i: 'w-pc-5', x: 0, y: 6, w: 6,  h: 4 },
      { i: 'w-pc-6', x: 6, y: 6, w: 6,  h: 4 },
    ],
  },
];

async function main() {
  console.log('Seeding dashboard templates globaux…');
  for (const tpl of TEMPLATES) {
    const { widgets, layout, ...tplData } = tpl;
    const existing = await prisma.dashboardTemplate.findUnique({ where: { id: tpl.id } });
    if (existing) {
      console.log(`  → "${tpl.name}" existe déjà — skip`);
      continue;
    }
    await prisma.dashboardTemplate.create({
      data: {
        ...tplData,
        companyId: null,
        layout,
        widgets: {
          create: widgets.map(w => ({ id: w.id, type: w.type, title: w.title, config: w.config, order: w.order })),
        },
      },
    });
    console.log(`  ✓ "${tpl.name}" créé (${widgets.length} widgets)`);
  }
  console.log('Done.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
