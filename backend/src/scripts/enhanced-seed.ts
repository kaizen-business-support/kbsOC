import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting enhanced database seeding with 30+ applications...');

  // Clear existing data
  await prisma.auditLog.deleteMany();
  await prisma.workflowStep.deleteMany();
  await prisma.document.deleteMany();
  await prisma.creditApplication.deleteMany();
  await prisma.financialData.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();

  console.log('🗑️ Cleared existing data');

  // Hash password for all demo users (demo123)
  const hashedPassword = await bcrypt.hash('demo123', 12);

  // Helper function to generate dates in the past
  const currentTime = new Date();
  const daysAgo = (days: number) => new Date(currentTime.getTime() - days * 24 * 60 * 60 * 1000);
  const hoursAgo = (hours: number) => new Date(currentTime.getTime() - hours * 60 * 60 * 1000);

  // Create users
  const users = await Promise.all([
    // Account Managers
    prisma.user.create({
      data: {
        id: 'user1',
        email: 'amadou.diop@bank.sn',
        passwordHash: hashedPassword,
        name: 'Amadou Diop',
        role: 'ACCOUNT_MANAGER',
        department: 'Dakar Central',
        jobTitle: 'Chargé d\'Affaires Senior',
        permissions: ["create_client", "create_application", "view_applications", "edit_client_data"],
        lastLogin: new Date(),
        isActive: true
      }
    }),
    prisma.user.create({
      data: {
        id: 'user7',
        email: 'marie.fall@bank.sn',
        passwordHash: hashedPassword,
        name: 'Marie Fall',
        role: 'ACCOUNT_MANAGER',
        department: 'Dakar Central',
        jobTitle: 'Chargée d\'Affaires',
        permissions: ["create_client", "create_application", "view_applications", "edit_client_data"],
        lastLogin: new Date(),
        isActive: true
      }
    }),
    prisma.user.create({
      data: {
        id: 'user8',
        email: 'ousmane.ba@bank.sn',
        passwordHash: hashedPassword,
        name: 'Ousmane Ba',
        role: 'ACCOUNT_MANAGER',
        department: 'Thiès',
        jobTitle: 'Chargé d\'Affaires',
        permissions: ["create_client", "create_application", "view_applications", "edit_client_data"],
        lastLogin: new Date(),
        isActive: true
      }
    }),
    prisma.user.create({
      data: {
        id: 'user9',
        email: 'aissatou.diagne@bank.sn',
        passwordHash: hashedPassword,
        name: 'Aissatou Diagne',
        role: 'ACCOUNT_MANAGER',
        department: 'Saint-Louis',
        jobTitle: 'Chargée d\'Affaires Senior',
        permissions: ["create_client", "create_application", "view_applications", "edit_client_data"],
        lastLogin: new Date(),
        isActive: true
      }
    }),
    prisma.user.create({
      data: {
        id: 'user10',
        email: 'ibrahima.seck@bank.sn',
        passwordHash: hashedPassword,
        name: 'Ibrahima Seck',
        role: 'ACCOUNT_MANAGER',
        department: 'Kaolack',
        jobTitle: 'Chargé d\'Affaires',
        permissions: ["create_client", "create_application", "view_applications", "edit_client_data"],
        lastLogin: new Date(),
        isActive: true
      }
    }),
    // Other roles
    prisma.user.create({
      data: {
        id: 'user2',
        email: 'fatou.ndiaye@bank.sn',
        passwordHash: hashedPassword,
        name: 'Fatou Ndiaye',
        role: 'CREDIT_ANALYST' as const,
        department: 'Risques',
        jobTitle: 'Analyste Crédit Principal',
        permissions: ["review_applications", "financial_analysis", "score_applications"],
        lastLogin: new Date(),
        isActive: true
      }
    }),
    prisma.user.create({
      data: {
        id: 'user3',
        email: 'moussa.sarr@bank.sn',
        passwordHash: hashedPassword,
        name: 'Moussa Sarr',
        role: 'BRANCH_MANAGER' as const,
        department: 'Direction Dakar Central',
        jobTitle: 'Directeur d\'Agence',
        permissions: ["approve_applications", "view_portfolio", "manage_team"],
        lastLogin: new Date(),
        isActive: true
      }
    })
  ]);

  console.log('👥 Created users');

  // Generate 35 diverse clients
  const clientsData = [];
  const companies = [
    'Société Générale de Commerce', 'Industries Textiles du Sahel', 'Transport et Logistique Express',
    'Entreprise de Construction Moderne', 'Import-Export Diallo & Fils', 'Pharmacie Centrale',
    'Restaurant Le Baobab', 'Atelier de Menuiserie', 'Société de Nettoyage', 'Boutique de Mode',
    'Centre de Formation', 'Garage Automobile', 'Boulangerie Artisanale', 'Salon de Coiffure',
    'Magasin d\'Électronique', 'Cabinet Dentaire', 'Librairie Papeterie', 'Hôtel des Voyageurs',
    'Société de Sécurité', 'Entreprise de Peinture', 'Laboratoire d\'Analyses', 'Cyber Café',
    'Agence de Publicité', 'Société de Nettoyage', 'Centre de Santé', 'École Privée',
    'Société d\'Informatique', 'Entreprise de Jardinage', 'Société de Catering', 'Atelier de Couture',
    'Société de Transport', 'Pharmacie de Quartier', 'Société d\'Import', 'Entreprise BTP',
    'Société Agro-alimentaire'
  ];

  const sectors = ['Commerce', 'Industrie', 'Transport', 'Construction', 'Services', 'Santé', 'Éducation', 'Technologie'];
  const userIds = ['user1', 'user7', 'user8', 'user9', 'user10'];

  for (let i = 0; i < 35; i++) {
    clientsData.push({
      id: `client${i + 1}`,
      companyName: companies[i % companies.length] + (i > companies.length - 1 ? ` ${Math.floor(i / companies.length) + 1}` : ''),
      rccm: `SN-DKR-${2018 + (i % 6)}-B-${12345 + i}`,
      ninea: `006${2018 + (i % 6)}${String(12345 + i).padStart(6, '0')}`,
      cofi: `M08${2018 + (i % 6)}${String(123456789 + i).substr(0, 9)}`,
      legalForm: ['SARL', 'SA', 'SUARL', 'GIE'][i % 4],
      sector: sectors[i % sectors.length],
      establishedYear: 2015 + (i % 8),
      headquarters: ['Dakar', 'Thiès', 'Saint-Louis', 'Kaolack', 'Ziguinchor'][i % 5] + ', Sénégal',
      contactPerson: `Contact Person ${i + 1}`,
      phone: `+221 77 ${String(123 + i).padStart(3, '0')} ${String(4567 + i).padStart(4, '0')}`,
      email: `contact${i + 1}@company${i + 1}.sn`,
      createdBy: userIds[i % userIds.length]
    });
  }

  const clients = await Promise.all(
    clientsData.map(data => prisma.client.create({ data }))
  );

  console.log('🏢 Created 35 clients');

  // Generate 45 applications with proper date distribution
  const statuses: ('SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED')[] = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'];
  const purposes = [
    'Financement du fonds de roulement',
    'Achat d\'équipement',
    'Extension des activités',
    'Refinancement de dettes',
    'Développement commercial',
    'Investissement immobilier',
    'Modernisation des outils'
  ];

  const applications = [];
  
  // Create applications distributed over the last 365 days
  for (let i = 0; i < 45; i++) {
    const daysBack = Math.floor(Math.random() * 365) + 1; // 1-365 days ago
    const creationDate = daysAgo(daysBack);
    const clientId = `client${(i % 35) + 1}`;
    const userId = userIds[i % userIds.length];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    
    applications.push({
      id: `app${i + 1}`,
      applicationNumber: `APP-2024-${String(1001 + i).padStart(6, '0')}`,
      clientId,
      amount: Math.floor(Math.random() * 50000000) + 1000000, // 1M to 50M
      purpose: purposes[Math.floor(Math.random() * purposes.length)],
      durationMonths: [12, 18, 24, 36, 48][Math.floor(Math.random() * 5)],
      proposedRate: Math.round((8 + Math.random() * 8) * 10) / 10, // 8-16%
      collateralType: ['Hypothèque', 'Gage', 'Caution', 'Nantissement'][Math.floor(Math.random() * 4)],
      collateralValue: Math.floor(Math.random() * 80000000) + 2000000,
      repaymentSchedule: 'MONTHLY' as const,
      status: status as 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED',
      score: {
        overall: Math.floor(Math.random() * 40) + 60, // 60-100
        liquidity: Math.floor(Math.random() * 40) + 60,
        leverage: Math.floor(Math.random() * 40) + 60,
        efficiency: Math.floor(Math.random() * 40) + 60,
        trend: Math.floor(Math.random() * 40) + 60,
        risk_level: ["low", "medium", "high"][Math.floor(Math.random() * 3)]
      },
      analysisResults: {
        recommendations: ["Suivi mensuel recommandé", "Diversification conseillée"],
        strengths: ["Position stable", "Équipe compétente"],
        weaknesses: ["Concurrence forte", "Saisonnalité"],
        conclusion: "Dossier analysé selon les critères standards"
      },
      submittedAt: creationDate,
      createdAt: creationDate,
      createdBy: userId
    });
  }

  const createdApplications = await Promise.all(
    applications.map(data => prisma.creditApplication.create({ data }))
  );

  console.log('📋 Created 45 applications with distributed dates');

  // Create workflow steps with proper timing and French names
  const workflowSteps = [];
  const stepNames = [
    'Application Créée',
    'Vérification Documents', 
    'Analyse Crédit',
    'Évaluation Risques',
    'Examen Directeur Agence',
    'Examen Comité Crédit'
  ];
  
  for (const app of createdApplications) {
    if (app.status === 'APPROVED' || app.status === 'REJECTED') {
      // Completed applications get full workflow sequence
      const appCreationDate = new Date(app.createdAt);
      let currentDate = new Date(appCreationDate);
      
      // Step 1: Application Créée (immediate)
      const step1EndDate = new Date(currentDate.getTime() + (0.5 + Math.random() * 1) * 60 * 60 * 1000); // 0.5-1.5 hours
      workflowSteps.push({
        id: `ws${app.id}_1`,
        applicationId: app.id,
        stepName: 'Application Créée',
        role: 'ACCOUNT_MANAGER' as const,
        assigneeId: app.createdBy,
        status: 'COMPLETED' as const,
        deadline: new Date(currentDate.getTime() + 24 * 60 * 60 * 1000),
        decision: 'APPROVE' as const,
        createdAt: currentDate,
        completedAt: step1EndDate,
        comments: 'Application créée et soumise'
      });

      // Step 2: Vérification Documents (1-3 hours after step 1)
      currentDate = new Date(step1EndDate.getTime() + Math.random() * 2 * 60 * 60 * 1000);
      const step2EndDate = new Date(currentDate.getTime() + (1 + Math.random() * 2) * 60 * 60 * 1000);
      workflowSteps.push({
        id: `ws${app.id}_2`,
        applicationId: app.id,
        stepName: 'Vérification Documents',
        role: 'ACCOUNT_MANAGER' as const,
        assigneeId: app.createdBy,
        status: 'COMPLETED' as const,
        deadline: new Date(currentDate.getTime() + 48 * 60 * 60 * 1000),
        decision: 'APPROVE' as const,
        createdAt: currentDate,
        completedAt: step2EndDate,
        comments: 'Documents vérifiés et conformes'
      });

      // Step 3: Analyse Crédit (4-8 hours after step 2)
      currentDate = new Date(step2EndDate.getTime() + (2 + Math.random() * 4) * 60 * 60 * 1000);
      const step3EndDate = new Date(currentDate.getTime() + (4 + Math.random() * 4) * 60 * 60 * 1000);
      workflowSteps.push({
        id: `ws${app.id}_3`,
        applicationId: app.id,
        stepName: 'Analyse Crédit',
        role: 'CREDIT_ANALYST' as const,
        assigneeId: 'user2',
        status: 'COMPLETED' as const,
        deadline: new Date(currentDate.getTime() + 72 * 60 * 60 * 1000),
        decision: 'APPROVE' as const,
        createdAt: currentDate,
        completedAt: step3EndDate,
        comments: 'Analyse de crédit complétée'
      });

      // Step 4: Évaluation Risques (2-4 hours after step 3)
      currentDate = new Date(step3EndDate.getTime() + Math.random() * 2 * 60 * 60 * 1000);
      const step4EndDate = new Date(currentDate.getTime() + (2 + Math.random() * 2) * 60 * 60 * 1000);
      workflowSteps.push({
        id: `ws${app.id}_4`,
        applicationId: app.id,
        stepName: 'Évaluation Risques',
        role: 'CREDIT_ANALYST' as const,
        assigneeId: 'user2',
        status: 'COMPLETED' as const,
        deadline: new Date(currentDate.getTime() + 24 * 60 * 60 * 1000),
        decision: 'APPROVE' as const,
        createdAt: currentDate,
        completedAt: step4EndDate,
        comments: 'Évaluation des risques terminée'
      });

      // Step 5: Examen Directeur Agence (1-2 hours after step 4)
      currentDate = new Date(step4EndDate.getTime() + Math.random() * 60 * 60 * 1000);
      const step5EndDate = new Date(currentDate.getTime() + (1 + Math.random()) * 60 * 60 * 1000);
      workflowSteps.push({
        id: `ws${app.id}_5`,
        applicationId: app.id,
        stepName: 'Examen Directeur Agence',
        role: 'BRANCH_MANAGER' as const,
        assigneeId: 'user3',
        status: 'COMPLETED' as const,
        deadline: new Date(currentDate.getTime() + 24 * 60 * 60 * 1000),
        decision: Number(app.amount) > 10000000 ? 'ESCALATE' : (app.status === 'APPROVED' ? 'APPROVE' : 'REJECT'),
        createdAt: currentDate,
        completedAt: step5EndDate,
        comments: Number(app.amount) > 10000000 ? 'Escaladé vers comité crédit' : (app.status === 'APPROVED' ? 'Approuvé par directeur' : 'Rejeté par directeur')
      });

      // Step 6: Examen Comité Crédit (only for large amounts or escalated cases)
      if (Number(app.amount) > 10000000) {
        currentDate = new Date(step5EndDate.getTime() + (2 + Math.random() * 4) * 60 * 60 * 1000);
        const step6EndDate = new Date(currentDate.getTime() + (1 + Math.random() * 2) * 60 * 60 * 1000);
        workflowSteps.push({
          id: `ws${app.id}_6`,
          applicationId: app.id,
          stepName: 'Examen Comité Crédit',
          role: 'CREDIT_COMMITTEE' as const,
          assigneeId: 'user3', // Using branch manager as committee member
          status: 'COMPLETED' as const,
          deadline: new Date(currentDate.getTime() + 48 * 60 * 60 * 1000),
          decision: app.status === 'APPROVED' ? 'APPROVE' : 'REJECT',
          createdAt: currentDate,
          completedAt: step6EndDate,
          comments: app.status === 'APPROVED' ? 'Approuvé par le comité de crédit' : 'Rejeté par le comité de crédit'
        });
      }
    } else if (app.status === 'UNDER_REVIEW') {
      // In progress applications - create partial workflow
      const appCreationDate = new Date(app.createdAt);
      let currentDate = new Date(appCreationDate);
      
      // Complete first few steps
      const step1EndDate = new Date(currentDate.getTime() + Math.random() * 60 * 60 * 1000);
      workflowSteps.push({
        id: `ws${app.id}_1`,
        applicationId: app.id,
        stepName: 'Application Créée',
        role: 'ACCOUNT_MANAGER' as const,
        assigneeId: app.createdBy,
        status: 'COMPLETED' as const,
        deadline: new Date(currentDate.getTime() + 24 * 60 * 60 * 1000),
        decision: 'APPROVE' as const,
        createdAt: currentDate,
        completedAt: step1EndDate,
        comments: 'Application créée'
      });

      currentDate = new Date(step1EndDate.getTime() + Math.random() * 60 * 60 * 1000);
      const step2EndDate = new Date(currentDate.getTime() + Math.random() * 2 * 60 * 60 * 1000);
      workflowSteps.push({
        id: `ws${app.id}_2`,
        applicationId: app.id,
        stepName: 'Vérification Documents',
        role: 'ACCOUNT_MANAGER' as const,
        assigneeId: app.createdBy,
        status: 'COMPLETED' as const,
        deadline: new Date(currentDate.getTime() + 48 * 60 * 60 * 1000),
        decision: 'APPROVE' as const,
        createdAt: currentDate,
        completedAt: step2EndDate,
        comments: 'Documents vérifiés'
      });

      // Current step in progress
      currentDate = new Date(step2EndDate.getTime() + Math.random() * 2 * 60 * 60 * 1000);
      workflowSteps.push({
        id: `ws${app.id}_3`,
        applicationId: app.id,
        stepName: 'Analyse Crédit',
        role: 'CREDIT_ANALYST' as const,
        assigneeId: 'user2',
        status: 'IN_REVIEW' as const,
        deadline: new Date(currentDate.getTime() + 72 * 60 * 60 * 1000),
        decision: null,
        createdAt: currentDate,
        completedAt: null,
        comments: null
      });
    }
  }

  if (workflowSteps.length > 0) {
    await Promise.all(
      workflowSteps.map(data => prisma.workflowStep.create({ data }))
    );
  }

  console.log(`🔄 Created ${workflowSteps.length} workflow steps with proper timing`);

  // Create audit logs
  const auditLogs = createdApplications.slice(0, 10).map((app, index) => ({
    id: `log${index + 1}`,
    entityType: 'CREDIT_APPLICATION',
    entityId: app.id,
    action: 'CREATE',
    userId: app.createdBy,
    createdAt: app.createdAt,
    oldValues: {},
    newValues: { status: app.status, amount: app.amount },
    ipAddress: '127.0.0.1',
    userAgent: 'Optimus Credit System'
  }));

  await Promise.all(
    auditLogs.map(data => prisma.auditLog.create({ data }))
  );

  console.log('📝 Created audit logs');

  // Calculate and display summary
  const totalApproved = createdApplications.filter(app => app.status === 'APPROVED').length;
  const totalRejected = createdApplications.filter(app => app.status === 'REJECTED').length;
  const totalUnderReview = createdApplications.filter(app => app.status === 'UNDER_REVIEW').length;
  const totalSubmitted = createdApplications.filter(app => app.status === 'SUBMITTED').length;
  const totalVolume = createdApplications.reduce((sum, app) => sum + Number(app.amount), 0);

  console.log('✅ Enhanced database seeding completed successfully!');
  console.log('📊 Summary:');
  console.log(`   - Users: ${users.length}`);
  console.log(`   - Clients: ${clients.length}`);
  console.log(`   - Applications: ${createdApplications.length}`);
  console.log(`   - Workflow Steps: ${workflowSteps.length}`);
  console.log(`   - Audit Logs: ${auditLogs.length}`);
  console.log('📈 Application Status Breakdown:');
  console.log(`   - APPROVED: ${totalApproved}`);
  console.log(`   - REJECTED: ${totalRejected}`);
  console.log(`   - UNDER_REVIEW: ${totalUnderReview}`);
  console.log(`   - SUBMITTED: ${totalSubmitted}`);
  console.log(`💰 Total Volume: ${(totalVolume / 1000000).toFixed(1)}M XOF`);
  
  // Show date distribution
  const now = new Date();
  const last7Days = createdApplications.filter(app => (now.getTime() - new Date(app.createdAt).getTime()) / (24 * 60 * 60 * 1000) <= 7).length;
  const last30Days = createdApplications.filter(app => (now.getTime() - new Date(app.createdAt).getTime()) / (24 * 60 * 60 * 1000) <= 30).length;
  const last90Days = createdApplications.filter(app => (now.getTime() - new Date(app.createdAt).getTime()) / (24 * 60 * 60 * 1000) <= 90).length;
  
  console.log('📅 Date Distribution:');
  console.log(`   - Last 7 days: ${last7Days} applications`);
  console.log(`   - Last 30 days: ${last30Days} applications`);  
  console.log(`   - Last 90 days: ${last90Days} applications`);
  console.log(`   - Older than 90 days: ${createdApplications.length - last90Days} applications`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });