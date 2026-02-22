import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

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

  // Create users - expanded with more branches and account managers
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
        jobTitle: 'Chargé d\'Affaires PME',
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
        jobTitle: 'Chargée d\'Affaires',
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
        jobTitle: 'Chargé d\'Affaires Corporate',
        permissions: ["create_client", "create_application", "view_applications", "edit_client_data"],
        lastLogin: new Date(),
        isActive: true
      }
    }),
    
    // Credit Analysts
    prisma.user.create({
      data: {
        id: 'user2',
        email: 'fatou.ndiaye@bank.sn',
        passwordHash: hashedPassword,
        name: 'Fatou Ndiaye',
        role: 'CREDIT_ANALYST',
        department: 'Risques',
        jobTitle: 'Analyste Crédit Principal',
        permissions: ["review_applications", "financial_analysis", "score_applications", "benchmark_analysis"],
        lastLogin: new Date(),
        isActive: true
      }
    }),
    prisma.user.create({
      data: {
        id: 'user11',
        email: 'cheikh.diallo@bank.sn',
        passwordHash: hashedPassword,
        name: 'Cheikh Diallo',
        role: 'CREDIT_ANALYST',
        department: 'Risques',
        jobTitle: 'Analyste Crédit Senior',
        permissions: ["review_applications", "financial_analysis", "score_applications", "benchmark_analysis"],
        lastLogin: new Date(),
        isActive: true
      }
    }),
    
    // Branch Managers
    prisma.user.create({
      data: {
        id: 'user3',
        email: 'moussa.sarr@bank.sn',
        passwordHash: hashedPassword,
        name: 'Moussa Sarr',
        role: 'BRANCH_MANAGER',
        department: 'Dakar Central',
        jobTitle: 'Directeur d\'Agence',
        permissions: ["approve_applications", "view_portfolio", "manage_team", "workflow_override"],
        lastLogin: new Date(),
        isActive: true
      }
    }),
    prisma.user.create({
      data: {
        id: 'user12',
        email: 'khadija.toure@bank.sn',
        passwordHash: hashedPassword,
        name: 'Khadija Touré',
        role: 'BRANCH_MANAGER',
        department: 'Thiès',
        jobTitle: 'Directrice d\'Agence',
        permissions: ["approve_applications", "view_portfolio", "manage_team", "workflow_override"],
        lastLogin: new Date(),
        isActive: true
      }
    }),
    prisma.user.create({
      data: {
        id: 'user13',
        email: 'mamadou.gueye@bank.sn',
        passwordHash: hashedPassword,
        name: 'Mamadou Gueye',
        role: 'BRANCH_MANAGER',
        department: 'Saint-Louis',
        jobTitle: 'Directeur d\'Agence',
        permissions: ["approve_applications", "view_portfolio", "manage_team", "workflow_override"],
        lastLogin: new Date(),
        isActive: true
      }
    }),
    
    // Committee and Management
    prisma.user.create({
      data: {
        id: 'user4',
        email: 'comite@bank.sn',
        passwordHash: hashedPassword,
        name: 'Secrétariat Comité de Crédit',
        role: 'CREDIT_COMMITTEE',
        department: 'Comité',
        jobTitle: 'Secrétaire du Comité',
        permissions: ["committee_review", "final_approval", "risk_override", "policy_exceptions"],
        lastLogin: new Date(),
        isActive: true
      }
    }),
    prisma.user.create({
      data: {
        id: 'user5',
        email: 'direction@bank.sn',
        passwordHash: hashedPassword,
        name: 'Direction Générale',
        role: 'MANAGEMENT',
        department: 'Direction Générale',
        jobTitle: 'Directeur Général',
        permissions: ["view_all", "portfolio_analytics", "risk_reporting", "policy_configuration", "user_management"],
        lastLogin: new Date(),
        isActive: true
      }
    }),
    prisma.user.create({
      data: {
        id: 'user6',
        email: 'admin@bank.sn',
        passwordHash: hashedPassword,
        name: 'Administrateur Système',
        role: 'ADMIN',
        department: 'IT',
        jobTitle: 'Administrateur Principal',
        permissions: ["system_administration", "user_management", "role_assignment", "system_configuration", "audit_logs", "data_export"],
        lastLogin: new Date(),
        isActive: true
      }
    })
  ]);

  console.log('👥 Created users');

  // Create clients - expanded with diverse companies across sectors
  const clients = await Promise.all([
    // Commerce
    prisma.client.create({
      data: {
        id: 'client1',
        companyName: 'Société Générale de Commerce',
        rccm: 'SN-DKR-2019-B-12345',
        ninea: '0062019012345',
        cofi: 'M082019123456789',
        legalForm: 'SARL',
        sector: 'Commerce',
        establishedYear: 2019,
        headquarters: 'Dakar, Sénégal',
        contactPerson: 'Moussa Ba',
        phone: '+221 77 123 4567',
        email: 'contact@sgc.sn',
        createdBy: 'user1'
      }
    }),
    prisma.client.create({
      data: {
        id: 'client4',
        companyName: 'Distribution Alimentaire de l\'Ouest',
        rccm: 'SN-DKR-2020-B-22222',
        ninea: '0062020022222',
        cofi: 'M082020222223456',
        legalForm: 'SARL',
        sector: 'Commerce',
        establishedYear: 2020,
        headquarters: 'Dakar, Sénégal',
        contactPerson: 'Aicha Sow',
        phone: '+221 77 456 7890',
        email: 'a.sow@dao.sn',
        createdBy: 'user7'
      }
    }),
    
    // Industrie
    prisma.client.create({
      data: {
        id: 'client2',
        companyName: 'Industries Textiles du Sahel',
        rccm: 'SN-DKR-2018-B-67890',
        ninea: '0062018067890',
        cofi: 'M082018678901234',
        legalForm: 'SA',
        sector: 'Industrie',
        establishedYear: 2018,
        headquarters: 'Thiès, Sénégal',
        contactPerson: 'Fatou Diallo',
        phone: '+221 77 234 5678',
        email: 'f.diallo@its.sn',
        createdBy: 'user8'
      }
    }),
    prisma.client.create({
      data: {
        id: 'client5',
        companyName: 'Minoterie Moderne du Sénégal',
        rccm: 'SN-THS-2017-B-33333',
        ninea: '0062017033333',
        cofi: 'M082017333334567',
        legalForm: 'SA',
        sector: 'Industrie',
        establishedYear: 2017,
        headquarters: 'Thiès, Sénégal',
        contactPerson: 'Abdou Faye',
        phone: '+221 77 567 8901',
        email: 'a.faye@mms.sn',
        createdBy: 'user8'
      }
    }),
    prisma.client.create({
      data: {
        id: 'client6',
        companyName: 'Conserverie des Fruits Tropicaux',
        rccm: 'SN-SLG-2019-B-44444',
        ninea: '0062019044444',
        cofi: 'M082019444445678',
        legalForm: 'SARL',
        sector: 'Industrie',
        establishedYear: 2019,
        headquarters: 'Saint-Louis, Sénégal',
        contactPerson: 'Mariama Sy',
        phone: '+221 77 678 9012',
        email: 'm.sy@cft.sn',
        createdBy: 'user9'
      }
    }),
    
    // Transport
    prisma.client.create({
      data: {
        id: 'client3',
        companyName: 'Transport et Logistique Express',
        rccm: 'SN-DKR-2020-B-11111',
        ninea: '0062020011111',
        cofi: 'M082020111112345',
        legalForm: 'SARL',
        sector: 'Transport',
        establishedYear: 2020,
        headquarters: 'Pikine, Sénégal',
        contactPerson: 'Ibrahima Sarr',
        phone: '+221 77 345 6789',
        email: 'i.sarr@tle.sn',
        createdBy: 'user1'
      }
    }),
    prisma.client.create({
      data: {
        id: 'client7',
        companyName: 'Compagnie de Transport Intercités',
        rccm: 'SN-KAO-2018-B-55555',
        ninea: '0062018055555',
        cofi: 'M082018555556789',
        legalForm: 'SA',
        sector: 'Transport',
        establishedYear: 2018,
        headquarters: 'Kaolack, Sénégal',
        contactPerson: 'Omar Cissé',
        phone: '+221 77 789 0123',
        email: 'o.cisse@cti.sn',
        createdBy: 'user10'
      }
    }),
    
    // Agriculture
    prisma.client.create({
      data: {
        id: 'client8',
        companyName: 'Coopérative Agricole de Casamance',
        rccm: 'SN-ZIG-2016-B-66666',
        ninea: '0062016066666',
        cofi: 'M082016666667890',
        legalForm: 'Coopérative',
        sector: 'Agriculture',
        establishedYear: 2016,
        headquarters: 'Ziguinchor, Sénégal',
        contactPerson: 'Alassane Diedhiou',
        phone: '+221 77 890 1234',
        email: 'a.diedhiou@cac.sn',
        createdBy: 'user9'
      }
    }),
    prisma.client.create({
      data: {
        id: 'client9',
        companyName: 'Élevage et Production Avicole',
        rccm: 'SN-THS-2019-B-77777',
        ninea: '0062019077777',
        cofi: 'M082019777778901',
        legalForm: 'SARL',
        sector: 'Agriculture',
        establishedYear: 2019,
        headquarters: 'Thiès, Sénégal',
        contactPerson: 'Bineta Ndiaye',
        phone: '+221 77 901 2345',
        email: 'b.ndiaye@epa.sn',
        createdBy: 'user8'
      }
    }),
    
    // Services
    prisma.client.create({
      data: {
        id: 'client10',
        companyName: 'Société de Conseil en Management',
        rccm: 'SN-DKR-2021-B-88888',
        ninea: '0062021088888',
        cofi: 'M082021888889012',
        legalForm: 'SARL',
        sector: 'Services',
        establishedYear: 2021,
        headquarters: 'Dakar, Sénégal',
        contactPerson: 'Cheikh Mbaye',
        phone: '+221 77 012 3456',
        email: 'c.mbaye@scm.sn',
        createdBy: 'user7'
      }
    }),
    prisma.client.create({
      data: {
        id: 'client11',
        companyName: 'Technologie et Informatique Solutions',
        rccm: 'SN-DKR-2020-B-99999',
        ninea: '0062020099999',
        cofi: 'M082020999990123',
        legalForm: 'SA',
        sector: 'Services',
        establishedYear: 2020,
        headquarters: 'Dakar, Sénégal',
        contactPerson: 'Ndeye Khady Diouf',
        phone: '+221 77 123 4567',
        email: 'nk.diouf@tis.sn',
        createdBy: 'user1'
      }
    }),
    
    // Construction
    prisma.client.create({
      data: {
        id: 'client12',
        companyName: 'Entreprise de Bâtiment et Travaux Publics',
        rccm: 'SN-DKR-2017-B-00000',
        ninea: '0062017000000',
        cofi: 'M082017000001234',
        legalForm: 'SA',
        sector: 'Construction',
        establishedYear: 2017,
        headquarters: 'Dakar, Sénégal',
        contactPerson: 'Modou Dia',
        phone: '+221 77 234 5678',
        email: 'm.dia@ebtp.sn',
        createdBy: 'user7'
      }
    }),
    
    // Tourisme
    prisma.client.create({
      data: {
        id: 'client13',
        companyName: 'Hôtellerie et Restauration du Littoral',
        rccm: 'SN-SLY-2018-B-11100',
        ninea: '0062018011100',
        cofi: 'M082018111001234',
        legalForm: 'SARL',
        sector: 'Tourisme',
        establishedYear: 2018,
        headquarters: 'Saly, Sénégal',
        contactPerson: 'Fatima Thiam',
        phone: '+221 77 345 6789',
        email: 'f.thiam@hrl.sn',
        createdBy: 'user9'
      }
    }),
    
    // Pêche
    prisma.client.create({
      data: {
        id: 'client14',
        companyName: 'Société de Pêche Industrielle',
        rccm: 'SN-SLG-2016-B-22200',
        ninea: '0062016022200',
        cofi: 'M082016222001234',
        legalForm: 'SA',
        sector: 'Pêche',
        establishedYear: 2016,
        headquarters: 'Saint-Louis, Sénégal',
        contactPerson: 'Babacar Samb',
        phone: '+221 77 456 7890',
        email: 'b.samb@spi.sn',
        createdBy: 'user9'
      }
    }),
    
    // Énergie
    prisma.client.create({
      data: {
        id: 'client15',
        companyName: 'Solutions Énergétiques Renouvelables',
        rccm: 'SN-THS-2021-B-33300',
        ninea: '0062021033300',
        cofi: 'M082021333001234',
        legalForm: 'SARL',
        sector: 'Énergie',
        establishedYear: 2021,
        headquarters: 'Thiès, Sénégal',
        contactPerson: 'Awa Diop',
        phone: '+221 77 567 8901',
        email: 'a.diop@ser.sn',
        createdBy: 'user8'
      }
    })
  ]);

  console.log('🏢 Created clients');

  // Create credit applications - massively expanded with diverse scenarios
  const now = new Date();
  
  // Helper function to generate dates in the past
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  
  const applications = await Promise.all([
    // Recent applications (1-7 days ago) - Various statuses
    prisma.creditApplication.create({
      data: {
        id: 'app1',
        applicationNumber: 'APP-2024-001234',
        clientId: 'client1',
        amount: 5000000.00,
        purpose: 'Financement du fonds de roulement pour extension des activités commerciales',
        durationMonths: 24,
        proposedRate: 12.5,
        collateralType: 'Hypothèque commerciale',
        collateralValue: 8000000.00,
        repaymentSchedule: 'MONTHLY',
        status: 'SUBMITTED',
        score: {
          overall: 85,
          profitability: 82,
          liquidity: 78,
          leverage: 75,
          efficiency: 88,
          trend: 85,
          risk_level: "low"
        },
        analysisResults: {
          recommendations: ["Surveillance mensuelle de la trésorerie", "Diversification des sources de revenus recommandée"],
          strengths: ["Position de marché solide", "Équipe de direction expérimentée"],
          weaknesses: ["Dépendance à quelques gros clients", "Saisonnalité des ventes"],
          conclusion: "Dossier acceptable avec surveillance renforcée"
        },
        submittedAt: daysAgo(1),
        createdAt: daysAgo(1),
        createdBy: 'user1'
      }
    }),
    
    prisma.creditApplication.create({
      data: {
        id: 'app2',
        applicationNumber: 'APP-2024-001235',
        clientId: 'client2',
        amount: 15000000.00,
        purpose: 'Acquisition de nouveaux équipements industriels',
        durationMonths: 36,
        proposedRate: 11.0,
        collateralType: 'Nantissement équipement',
        collateralValue: 20000000.00,
        repaymentSchedule: 'QUARTERLY',
        status: 'UNDER_REVIEW',
        score: {
          overall: 78,
          profitability: 75,
          liquidity: 72,
          leverage: 80,
          efficiency: 85,
          trend: 76,
          risk_level: "medium"
        },
        analysisResults: {
          recommendations: ["Surveillance trimestrielle", "Amélioration des ratios de liquidité"],
          strengths: ["Secteur porteur", "Équipements modernes"],
          weaknesses: ["Besoin en fonds de roulement", "Concurrence intense"],
          conclusion: "Dossier nécessitant un suivi rapproché"
        },
        submittedAt: daysAgo(3),
        createdBy: 'user8'
      }
    }),
    
    prisma.creditApplication.create({
      data: {
        id: 'app3',
        applicationNumber: 'APP-2024-001236',
        clientId: 'client3',
        amount: 3000000.00,
        purpose: 'Renouvellement de la flotte de véhicules de transport',
        durationMonths: 18,
        proposedRate: 13.0,
        collateralType: 'Gage sur véhicules',
        collateralValue: 4500000.00,
        repaymentSchedule: 'MONTHLY',
        status: 'APPROVED',
        score: {
          overall: 90,
          profitability: 88,
          liquidity: 85,
          leverage: 82,
          efficiency: 92,
          trend: 89,
          risk_level: "low"
        },
        analysisResults: {
          recommendations: ["Suivi mensuel standard"],
          strengths: ["Croissance soutenue", "Gestion rigoureuse"],
          weaknesses: ["Dépendance au secteur transport"],
          conclusion: "Dossier excellent - approbation recommandée"
        },
        submittedAt: daysAgo(7),
        createdBy: 'user1'
      }
    }),

    // Week 2 applications (8-14 days ago)
    prisma.creditApplication.create({
      data: {
        id: 'app4',
        applicationNumber: 'APP-2024-001237',
        clientId: 'client4',
        amount: 8500000.00,
        purpose: 'Extension du réseau de distribution alimentaire',
        durationMonths: 30,
        proposedRate: 12.0,
        collateralType: 'Hypothèque sur entrepôt',
        collateralValue: 12000000.00,
        repaymentSchedule: 'MONTHLY',
        status: 'APPROVED',
        score: {
          overall: 83,
          profitability: 80,
          liquidity: 85,
          leverage: 78,
          efficiency: 86,
          trend: 82,
          risk_level: "low"
        },
        analysisResults: {
          recommendations: ["Contrôle mensuel des stocks", "Optimisation des circuits de distribution"],
          strengths: ["Forte demande du marché", "Expérience du management"],
          weaknesses: ["Saisonnalité", "Concurrence locale"],
          conclusion: "Projet viable avec un bon potentiel de croissance"
        },
        submittedAt: daysAgo(12),
        createdBy: 'user7'
      }
    }),

    prisma.creditApplication.create({
      data: {
        id: 'app5',
        applicationNumber: 'APP-2024-001238',
        clientId: 'client5',
        amount: 25000000.00,
        purpose: 'Modernisation de la ligne de production de farine',
        durationMonths: 48,
        proposedRate: 10.5,
        collateralType: 'Hypothèque industrielle',
        collateralValue: 35000000.00,
        repaymentSchedule: 'QUARTERLY',
        status: 'REJECTED',
        score: {
          overall: 65,
          profitability: 68,
          liquidity: 58,
          leverage: 70,
          efficiency: 72,
          trend: 60,
          risk_level: "high"
        },
        analysisResults: {
          recommendations: ["Améliorer la structure financière avant nouvelle demande"],
          strengths: ["Position sur le marché", "Équipements récents"],
          weaknesses: ["Ratio d'endettement élevé", "Liquidité insuffisante", "Dépendance aux matières premières"],
          conclusion: "Risque trop élevé dans les conditions actuelles"
        },
        submittedAt: daysAgo(14),
        createdBy: 'user8'
      }
    }),

    // Week 3 applications (15-21 days ago)
    prisma.creditApplication.create({
      data: {
        id: 'app6',
        applicationNumber: 'APP-2024-001239',
        clientId: 'client6',
        amount: 12000000.00,
        purpose: 'Installation d\'une nouvelle ligne de conserves de fruits',
        durationMonths: 36,
        proposedRate: 11.5,
        collateralType: 'Nantissement matériel',
        collateralValue: 18000000.00,
        repaymentSchedule: 'MONTHLY',
        status: 'APPROVED',
        score: {
          overall: 88,
          profitability: 90,
          liquidity: 82,
          leverage: 85,
          efficiency: 91,
          trend: 89,
          risk_level: "low"
        },
        analysisResults: {
          recommendations: ["Suivi mensuel de la production", "Diversification des canaux de vente"],
          strengths: ["Innovation produit", "Marché en croissance", "Management compétent"],
          weaknesses: ["Dépendance saisonnière des matières premières"],
          conclusion: "Excellent projet avec fort potentiel d'exportation"
        },
        submittedAt: daysAgo(18),
        createdBy: 'user9'
      }
    }),

    prisma.creditApplication.create({
      data: {
        id: 'app7',
        applicationNumber: 'APP-2024-001240',
        clientId: 'client7',
        amount: 18000000.00,
        purpose: 'Acquisition de 15 nouveaux autobus pour transport intercités',
        durationMonths: 42,
        proposedRate: 12.8,
        collateralType: 'Gage sur véhicules',
        collateralValue: 22000000.00,
        repaymentSchedule: 'MONTHLY',
        status: 'UNDER_REVIEW',
        score: {
          overall: 76,
          profitability: 78,
          liquidity: 70,
          leverage: 80,
          efficiency: 75,
          trend: 78,
          risk_level: "medium"
        },
        analysisResults: {
          recommendations: ["Surveillance des coûts opérationnels", "Diversification géographique"],
          strengths: ["Licence de transport", "Réseau établi"],
          weaknesses: ["Concurrence forte", "Maintenance coûteuse"],
          conclusion: "Projet acceptable mais nécessite un suivi attentif"
        },
        submittedAt: daysAgo(21),
        createdBy: 'user10'
      }
    }),

    // Month ago applications (22-30 days ago)  
    prisma.creditApplication.create({
      data: {
        id: 'app8',
        applicationNumber: 'APP-2024-001241',
        clientId: 'client8',
        amount: 6500000.00,
        purpose: 'Financement de la campagne agricole rizicole',
        durationMonths: 12,
        proposedRate: 8.5,
        collateralType: 'Nantissement sur récolte',
        collateralValue: 8000000.00,
        repaymentSchedule: 'ANNUAL',
        status: 'APPROVED',
        score: {
          overall: 82,
          profitability: 85,
          liquidity: 75,
          leverage: 80,
          efficiency: 88,
          trend: 84,
          risk_level: "medium"
        },
        analysisResults: {
          recommendations: ["Suivi de la météo", "Assurance récolte recommandée"],
          strengths: ["Coopérative bien organisée", "Débouchés garantis"],
          weaknesses: ["Risque climatique", "Fluctuation des prix"],
          conclusion: "Financement agricole standard avec garanties appropriées"
        },
        submittedAt: daysAgo(25),
        createdBy: 'user9'
      }
    }),

    prisma.creditApplication.create({
      data: {
        id: 'app9',
        applicationNumber: 'APP-2024-001242',
        clientId: 'client9',
        amount: 9500000.00,
        purpose: 'Construction de nouveaux poulaillers et équipements avicoles',
        durationMonths: 24,
        proposedRate: 11.0,
        collateralType: 'Hypothèque sur installations',
        collateralValue: 14000000.00,
        repaymentSchedule: 'MONTHLY',
        status: 'APPROVED',
        score: {
          overall: 86,
          profitability: 88,
          liquidity: 81,
          leverage: 84,
          efficiency: 89,
          trend: 87,
          risk_level: "low"
        },
        analysisResults: {
          recommendations: ["Surveillance sanitaire", "Diversification des produits"],
          strengths: ["Marché local porteur", "Expérience technique"],
          weaknesses: ["Risques sanitaires", "Volatilité des prix"],
          conclusion: "Secteur prometteur avec management expérimenté"
        },
        submittedAt: daysAgo(28),
        createdBy: 'user8'
      }
    }),

    // Older applications (31-60 days ago) - Mix of completed and rejected
    prisma.creditApplication.create({
      data: {
        id: 'app10',
        applicationNumber: 'APP-2024-001243',
        clientId: 'client10',
        amount: 4500000.00,
        purpose: 'Équipement informatique et formation du personnel',
        durationMonths: 18,
        proposedRate: 13.5,
        collateralType: 'Caution personnelle',
        collateralValue: 6000000.00,
        repaymentSchedule: 'MONTHLY',
        status: 'APPROVED',
        score: {
          overall: 79,
          profitability: 82,
          liquidity: 74,
          leverage: 78,
          efficiency: 83,
          trend: 80,
          risk_level: "medium"
        },
        analysisResults: {
          recommendations: ["Suivi des contrats clients", "Formation continue"],
          strengths: ["Secteur en croissance", "Équipe qualifiée"],
          weaknesses: ["Concurrence internationale", "Dépendance technologique"],
          conclusion: "Bon potentiel avec suivi des développements technologiques"
        },
        submittedAt: daysAgo(35),
        createdBy: 'user7'
      }
    }),

    prisma.creditApplication.create({
      data: {
        id: 'app11',
        applicationNumber: 'APP-2024-001244',
        clientId: 'client11',
        amount: 22000000.00,
        purpose: 'Développement de solutions logicielles bancaires',
        durationMonths: 36,
        proposedRate: 12.0,
        collateralType: 'Nantissement sur licences',
        collateralValue: 25000000.00,
        repaymentSchedule: 'QUARTERLY',
        status: 'REJECTED',
        score: {
          overall: 70,
          profitability: 75,
          liquidity: 62,
          leverage: 75,
          efficiency: 78,
          trend: 68,
          risk_level: "high"
        },
        analysisResults: {
          recommendations: ["Renforcer les fonds propres", "Sécuriser les contrats clients"],
          strengths: ["Innovation", "Marché porteur"],
          weaknesses: ["Liquidité faible", "Concurrence forte", "Risque technologique"],
          conclusion: "Projet innovant mais risques financiers trop élevés"
        },
        submittedAt: daysAgo(42),
        createdBy: 'user1'
      }
    }),

    prisma.creditApplication.create({
      data: {
        id: 'app12',
        applicationNumber: 'APP-2024-001245',
        clientId: 'client12',
        amount: 35000000.00,
        purpose: 'Construction d\'un complexe résidentiel de 50 logements',
        durationMonths: 60,
        proposedRate: 10.0,
        collateralType: 'Hypothèque sur terrain et constructions',
        collateralValue: 50000000.00,
        repaymentSchedule: 'QUARTERLY',
        status: 'APPROVED',
        score: {
          overall: 84,
          profitability: 86,
          liquidity: 78,
          leverage: 85,
          efficiency: 87,
          trend: 83,
          risk_level: "medium"
        },
        analysisResults: {
          recommendations: ["Surveillance du chantier", "Précommercialisation"],
          strengths: ["Demande forte", "Emplacement stratégique", "Expérience du promoteur"],
          weaknesses: ["Durée du projet", "Risque de construction"],
          conclusion: "Projet immobilier solide dans un marché porteur"
        },
        submittedAt: daysAgo(45),
        createdBy: 'user7'
      }
    }),

    // Additional diverse applications for better analytics
    prisma.creditApplication.create({
      data: {
        id: 'app13',
        applicationNumber: 'APP-2024-001246',
        clientId: 'client13',
        amount: 15500000.00,
        purpose: 'Rénovation et extension de l\'hôtel (30 nouvelles chambres)',
        durationMonths: 48,
        proposedRate: 11.8,
        collateralType: 'Hypothèque hôtelière',
        collateralValue: 25000000.00,
        repaymentSchedule: 'MONTHLY',
        status: 'UNDER_REVIEW',
        score: {
          overall: 81,
          profitability: 83,
          liquidity: 76,
          leverage: 82,
          efficiency: 85,
          trend: 79,
          risk_level: "medium"
        },
        analysisResults: {
          recommendations: ["Diversifier la clientèle", "Plan marketing renforcé"],
          strengths: ["Emplacement touristique", "Saison haute rentable"],
          weaknesses: ["Saisonnalité forte", "Concurrence hôtelière"],
          conclusion: "Secteur touristique avec potentiel mais volatil"
        },
        submittedAt: daysAgo(50),
        createdBy: 'user9'
      }
    }),

    prisma.creditApplication.create({
      data: {
        id: 'app14',
        applicationNumber: 'APP-2024-001247',
        clientId: 'client14',
        amount: 28000000.00,
        purpose: 'Acquisition de deux nouveaux chalutiers de pêche',
        durationMonths: 84,
        proposedRate: 9.5,
        collateralType: 'Hypothèque maritime',
        collateralValue: 40000000.00,
        repaymentSchedule: 'QUARTERLY',
        status: 'APPROVED',
        score: {
          overall: 87,
          profitability: 89,
          liquidity: 83,
          leverage: 88,
          efficiency: 90,
          trend: 86,
          risk_level: "low"
        },
        analysisResults: {
          recommendations: ["Assurance maritime complète", "Diversification des zones de pêche"],
          strengths: ["Licences de pêche", "Marché d'exportation", "Équipe expérimentée"],
          weaknesses: ["Réglementation stricte", "Risques météorologiques"],
          conclusion: "Secteur profitable avec débouchés à l'export garantis"
        },
        submittedAt: daysAgo(55),
        createdBy: 'user9'
      }
    }),

    prisma.creditApplication.create({
      data: {
        id: 'app15',
        applicationNumber: 'APP-2024-001248',
        clientId: 'client15',
        amount: 20000000.00,
        purpose: 'Installation de panneaux solaires et systèmes de stockage',
        durationMonths: 72,
        proposedRate: 9.0,
        collateralType: 'Nantissement sur équipements',
        collateralValue: 30000000.00,
        repaymentSchedule: 'QUARTERLY',
        status: 'APPROVED',
        score: {
          overall: 92,
          profitability: 94,
          liquidity: 88,
          leverage: 90,
          efficiency: 95,
          trend: 93,
          risk_level: "very_low"
        },
        analysisResults: {
          recommendations: ["Maintenance préventive", "Extension progressive du réseau"],
          strengths: ["Secteur d'avenir", "Subventions gouvernementales", "Contrats long terme"],
          weaknesses: ["Investissement initial élevé", "Technologie évolutive"],
          conclusion: "Projet exemplaire dans les énergies renouvelables"
        },
        submittedAt: daysAgo(60),
        createdBy: 'user8'
      }
    })
  ]);

  console.log('📋 Created credit applications');

  // Create workflow steps
  const workflowSteps = await Promise.all([
    // For app1 (submitted - all pending)
    prisma.workflowStep.create({
      data: {
        id: 'ws1',
        applicationId: 'app1',
        stepName: 'Review by credit analyst',
        role: 'CREDIT_ANALYST',
        assigneeId: 'user2',
        status: 'PENDING',
        deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      }
    }),
    prisma.workflowStep.create({
      data: {
        id: 'ws2',
        applicationId: 'app1',
        stepName: 'Review by branch manager',
        role: 'BRANCH_MANAGER',
        assigneeId: 'user3',
        status: 'PENDING',
        deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      }
    }),
    
    // For app2 (under review - analyst completed, branch pending)
    prisma.workflowStep.create({
      data: {
        id: 'ws4',
        applicationId: 'app2',
        stepName: 'Review by credit analyst',
        role: 'CREDIT_ANALYST',
        assigneeId: 'user2',
        status: 'COMPLETED',
        deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        decision: 'APPROVE',
        completedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        comments: 'Reviewed and approved by Fatou Ndiaye'
      }
    }),
    prisma.workflowStep.create({
      data: {
        id: 'ws5',
        applicationId: 'app2',
        stepName: 'Review by branch manager',
        role: 'BRANCH_MANAGER',
        assigneeId: 'user3',
        status: 'PENDING',
        deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      }
    }),
    
    // For app3 (approved - all completed)
    prisma.workflowStep.create({
      data: {
        id: 'ws7',
        applicationId: 'app3',
        stepName: 'Review by credit analyst',
        role: 'CREDIT_ANALYST',
        assigneeId: 'user2',
        status: 'COMPLETED',
        deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        decision: 'APPROVE',
        completedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
        comments: 'Reviewed and approved by Fatou Ndiaye'
      }
    }),
    prisma.workflowStep.create({
      data: {
        id: 'ws8',
        applicationId: 'app3',
        stepName: 'Review by branch manager',
        role: 'BRANCH_MANAGER',
        assigneeId: 'user3',
        status: 'COMPLETED',
        deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        decision: 'APPROVE',
        completedAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
        comments: 'Reviewed and approved by Moussa Sarr'
      }
    }),
    prisma.workflowStep.create({
      data: {
        id: 'ws9',
        applicationId: 'app3',
        stepName: 'Review by credit committee',
        role: 'CREDIT_COMMITTEE',
        assigneeId: 'user4',
        status: 'COMPLETED',
        deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        decision: 'APPROVE',
        completedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
        comments: 'Reviewed and approved by Secrétariat Comité de Crédit'
      }
    }),

    // For approved applications (app4-app15), add completed workflow steps
    // App4 - Approved (Marie Fall, Dakar Central)
    prisma.workflowStep.create({
      data: {
        id: 'ws10',
        applicationId: 'app4',
        stepName: 'Review by credit analyst',
        role: 'CREDIT_ANALYST',
        assigneeId: 'user2',
        status: 'COMPLETED',
        deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        decision: 'APPROVE',
        completedAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
        comments: 'Analysé et approuvé'
      }
    }),
    prisma.workflowStep.create({
      data: {
        id: 'ws11',
        applicationId: 'app4',
        stepName: 'Review by branch manager',
        role: 'BRANCH_MANAGER',
        assigneeId: 'user3',
        status: 'COMPLETED',
        deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        decision: 'APPROVE',
        completedAt: new Date(now.getTime() - 18 * 24 * 60 * 60 * 1000),
        comments: 'Validé par la direction'
      }
    }),

    // App5 - Rejected (Ousmane Ba, Thiès)
    prisma.workflowStep.create({
      data: {
        id: 'ws12',
        applicationId: 'app5',
        stepName: 'Review by credit analyst',
        role: 'CREDIT_ANALYST',
        assigneeId: 'user2',
        status: 'COMPLETED',
        deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        decision: 'REJECT',
        completedAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
        comments: 'Risques financiers trop élevés'
      }
    }),

    // App6 - Approved (Aissatou Diagne, Saint-Louis)
    prisma.workflowStep.create({
      data: {
        id: 'ws13',
        applicationId: 'app6',
        stepName: 'Review by credit analyst',
        role: 'CREDIT_ANALYST',
        assigneeId: 'user2',
        status: 'COMPLETED',
        deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        decision: 'APPROVE',
        completedAt: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000),
        comments: 'Dossier solide, approuvé'
      }
    }),
    prisma.workflowStep.create({
      data: {
        id: 'ws14',
        applicationId: 'app6',
        stepName: 'Review by branch manager',
        role: 'BRANCH_MANAGER',
        assigneeId: 'user3',
        status: 'COMPLETED',
        deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        decision: 'APPROVE',
        completedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
        comments: 'Approuvé définitivement'
      }
    }),

    // App8 - Approved (Aissatou Diagne, Saint-Louis)
    prisma.workflowStep.create({
      data: {
        id: 'ws15',
        applicationId: 'app8',
        stepName: 'Review by credit analyst',
        role: 'CREDIT_ANALYST',
        assigneeId: 'user2',
        status: 'COMPLETED',
        deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        decision: 'APPROVE',
        completedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
        comments: 'Projet viable, approuvé'
      }
    }),
    prisma.workflowStep.create({
      data: {
        id: 'ws16',
        applicationId: 'app8',
        stepName: 'Review by branch manager',
        role: 'BRANCH_MANAGER',
        assigneeId: 'user3',
        status: 'COMPLETED',
        deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        decision: 'APPROVE',
        completedAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
        comments: 'Validation finale accordée'
      }
    }),

    // App9 - Approved (Ousmane Ba, Thiès)
    prisma.workflowStep.create({
      data: {
        id: 'ws17',
        applicationId: 'app9',
        stepName: 'Review by credit analyst',
        role: 'CREDIT_ANALYST',
        assigneeId: 'user2',
        status: 'COMPLETED',
        deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        decision: 'APPROVE',
        completedAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
        comments: 'Analyse positive'
      }
    }),
    prisma.workflowStep.create({
      data: {
        id: 'ws18',
        applicationId: 'app9',
        stepName: 'Review by branch manager',
        role: 'BRANCH_MANAGER',
        assigneeId: 'user3',
        status: 'COMPLETED',
        deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        decision: 'APPROVE',
        completedAt: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000),
        comments: 'Approuvé sans réserve'
      }
    }),

    // App10 - Approved (Marie Fall, Dakar Central)
    prisma.workflowStep.create({
      data: {
        id: 'ws19',
        applicationId: 'app10',
        stepName: 'Review by credit analyst',
        role: 'CREDIT_ANALYST',
        assigneeId: 'user2',
        status: 'COMPLETED',
        deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        decision: 'APPROVE',
        completedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        comments: 'Secteur IT prometteur'
      }
    }),
    prisma.workflowStep.create({
      data: {
        id: 'ws20',
        applicationId: 'app10',
        stepName: 'Review by branch manager',
        role: 'BRANCH_MANAGER',
        assigneeId: 'user3',
        status: 'COMPLETED',
        deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        decision: 'APPROVE',
        completedAt: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000),
        comments: 'Approuvé'
      }
    }),

    // App11 - Rejected (Amadou Diop, Dakar Central)
    prisma.workflowStep.create({
      data: {
        id: 'ws21',
        applicationId: 'app11',
        stepName: 'Review by credit analyst',
        role: 'CREDIT_ANALYST',
        assigneeId: 'user2',
        status: 'COMPLETED',
        deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        decision: 'REJECT',
        completedAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
        comments: 'Risques trop élevés pour ce projet'
      }
    })
  ]);

  console.log('🔄 Created workflow steps');

  // Create audit logs
  await Promise.all([
    prisma.auditLog.create({
      data: {
        id: 'audit1',
        userId: 'user1',
        applicationId: 'app1',
        action: 'CREATE_APPLICATION',
        entityType: 'APPLICATION',
        entityId: 'app1',
        newValues: {
          amount: "5000000.00",
          purpose: "Financement du fonds de roulement pour extension des activités commerciales",
          status: "submitted"
        },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }),
    prisma.auditLog.create({
      data: {
        id: 'audit2',
        userId: 'user1',
        applicationId: 'app2',
        action: 'CREATE_APPLICATION',
        entityType: 'APPLICATION',
        entityId: 'app2',
        newValues: {
          amount: "15000000.00",
          purpose: "Acquisition de nouveaux équipements industriels",
          status: "under_review"
        },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }),
    prisma.auditLog.create({
      data: {
        id: 'audit3',
        userId: 'user1',
        applicationId: 'app3',
        action: 'CREATE_APPLICATION',
        entityType: 'APPLICATION',
        entityId: 'app3',
        newValues: {
          amount: "3000000.00",
          purpose: "Renouvellement de la flotte de véhicules de transport",
          status: "approved"
        },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
  ]);

  console.log('📝 Created audit logs');

  console.log('✅ Database seeding completed successfully!');
  console.log('📊 Summary:');
  console.log(`   - Users: ${users.length}`);
  console.log(`   - Clients: ${clients.length}`);
  console.log(`   - Applications: ${applications.length}`);
  console.log(`   - Workflow Steps: ${workflowSteps.length}`);
  console.log('📈 Application Status Breakdown:');
  const statusCounts = applications.reduce((acc, app) => {
    acc[app.status] = (acc[app.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   - ${status}: ${count}`);
  });
  console.log(`💰 Total Volume: ${applications.reduce((sum, app) => sum + Number(app.amount), 0).toLocaleString()} XOF`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });