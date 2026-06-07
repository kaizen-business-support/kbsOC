import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface DashboardTemplateData {
  name: string;
  description: string;
  isGlobal: boolean;
  layout: Prisma.InputJsonValue;
  widgets: Array<{
    type: string;
    title: string;
    config: Prisma.InputJsonValue;
    order: number;
  }>;
}

const GLOBAL_TEMPLATES: DashboardTemplateData[] = [
  {
    name: 'Suivi Portefeuille',
    description:
      "Vue d'ensemble du portefeuille de crédit : dossiers par statut, montants engagés, délais.",
    isGlobal: true,
    layout: [
      { i: 'tpl-w-1', x: 0, y: 0, w: 3, h: 2 },
      { i: 'tpl-w-2', x: 3, y: 0, w: 3, h: 2 },
      { i: 'tpl-w-3', x: 6, y: 0, w: 6, h: 4 },
    ],
    widgets: [
      {
        type: 'kpi_card',
        title: 'Dossiers en cours',
        config: {
          source: 'applications',
          metric: 'count',
          filter: { status: 'IN_PROGRESS' },
        },
        order: 0,
      },
      {
        type: 'kpi_card',
        title: 'Montants engagés (XOF)',
        config: {
          source: 'applications',
          metric: 'sum_amount',
          filter: { status: 'APPROVED' },
        },
        order: 1,
      },
      {
        type: 'bar_chart',
        title: 'Répartition par statut',
        config: { source: 'applications', groupBy: 'status' },
        order: 2,
      },
    ],
  },
  {
    name: 'Performance Mensuelle',
    description:
      'Suivi de la performance mensuelle : taux d\'approbation, volumes, délais de traitement.',
    isGlobal: true,
    layout: [
      { i: 'tpl-w-4', x: 0, y: 0, w: 6, h: 4 },
      { i: 'tpl-w-5', x: 6, y: 0, w: 6, h: 4 },
      { i: 'tpl-w-6', x: 0, y: 4, w: 4, h: 2 },
    ],
    widgets: [
      {
        type: 'line_chart',
        title: 'Nouveaux dossiers / mois',
        config: { source: 'applications', groupBy: 'month', metric: 'count' },
        order: 0,
      },
      {
        type: 'bar_chart',
        title: 'Dossiers approuvés vs rejetés',
        config: { source: 'applications', groupBy: 'month', split: 'status' },
        order: 1,
      },
      {
        type: 'kpi_card',
        title: "Taux d'approbation",
        config: { source: 'applications', metric: 'approval_rate' },
        order: 2,
      },
    ],
  },
  {
    name: 'Conformité BCEAO',
    description:
      'Tableau de bord normatif BCEAO : ratios réglementaires et alertes de dépassement.',
    isGlobal: true,
    layout: [
      { i: 'tpl-w-7', x: 0, y: 0, w: 4, h: 3 },
      { i: 'tpl-w-8', x: 4, y: 0, w: 4, h: 3 },
      { i: 'tpl-w-9', x: 8, y: 0, w: 4, h: 3 },
    ],
    widgets: [
      {
        type: 'gauge',
        title: 'Ratio de solvabilité',
        config: {
          source: 'analytics',
          metric: 'solvency_ratio',
          threshold: { warning: 8, critical: 6 },
        },
        order: 0,
      },
      {
        type: 'gauge',
        title: 'Ratio de liquidité',
        config: {
          source: 'analytics',
          metric: 'liquidity_ratio',
          threshold: { warning: 100, critical: 80 },
        },
        order: 1,
      },
      {
        type: 'kpi_card',
        title: 'Créances douteuses (%)',
        config: { source: 'analytics', metric: 'npl_ratio' },
        order: 2,
      },
    ],
  },
];

export async function seedDashboardTemplates() {
  console.log('🌱 Seeding dashboard templates...');

  for (const tpl of GLOBAL_TEMPLATES) {
    const existing = await prisma.dashboardTemplate.findFirst({
      where: { name: tpl.name, isGlobal: true },
    });

    if (existing) {
      console.log(`  ⏭  Template "${tpl.name}" already exists, skipping`);
      continue;
    }

    const widgets = tpl.widgets.map(w => ({
      type: w.type,
      title: w.title,
      config: w.config,
      order: w.order,
    }));

    await prisma.dashboardTemplate.create({
      data: {
        name: tpl.name,
        description: tpl.description,
        companyId: null,
        isGlobal: tpl.isGlobal,
        layout: tpl.layout,
        widgets: { create: widgets },
      },
    });

    console.log(`  ✅ Template "${tpl.name}" created`);
  }

  console.log('✅ Dashboard templates seed complete');
}

if (require.main === module) {
  seedDashboardTemplates()
    .catch(e => {
      console.error('❌ Error seeding dashboard templates:', e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
