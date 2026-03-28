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
    }),

    // Responsable Analyste
    prisma.user.create({
      data: {
        id: 'user16',
        email: 'resp.analyste@bank.sn',
        passwordHash: hashedPassword,
        name: 'Aminata Niang',
        role: 'ANALYST_SUPERVISOR',
        department: 'Risques',
        jobTitle: 'Responsable Analyste Crédit',
        permissions: ["dispatch_applications", "view_analyst_workload", "assign_analyst", "view_applications", "review_applications"],
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
        status: 'UNDER_REVIEW',
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
          conclusion: "Dossier acceptable avec surveillance renforcée",
          preliminaryAnalysis: {
            overallScore: 85,
            financialScore: 80,
            analystScore: 85,
            overallAnalysis: "Dossier solide avec risque faible",
            recommendations: ["Surveillance mensuelle de la trésorerie"]
          },
          financialData: {
            2024: {
              multiyear_data: { N: { data: { chiffre_affaires: 4800000, total_actif: 7200000, capitaux_propres: 3100000, resultat_net: 420000, actif_immobilise: 2800000, stocks: 950000, creances_clients: 780000, tresorerie_actif: 420000, dettes_fournisseurs: 650000, dettes_financieres: 2400000, total_passif: 7200000 } } },
              ratios: { currentRatio: 1.72, netMargin: 8.75, roa: 5.83, debtToEquity: 1.32, revenueGrowth: 12.5 }
            },
            2023: {
              multiyear_data: { N: { data: { chiffre_affaires: 4270000, total_actif: 6500000, capitaux_propres: 2750000, resultat_net: 350000, actif_immobilise: 2500000, stocks: 820000, creances_clients: 680000, tresorerie_actif: 380000, dettes_fournisseurs: 580000, dettes_financieres: 2200000, total_passif: 6500000 } } },
              ratios: { currentRatio: 1.61, netMargin: 8.20, roa: 5.38, debtToEquity: 1.45, revenueGrowth: 8.2 }
            },
            2022: {
              multiyear_data: { N: { data: { chiffre_affaires: 3945000, total_actif: 5900000, capitaux_propres: 2450000, resultat_net: 295000, actif_immobilise: 2200000, stocks: 730000, creances_clients: 610000, tresorerie_actif: 320000, dettes_fournisseurs: 520000, dettes_financieres: 2000000, total_passif: 5900000 } } },
              ratios: { currentRatio: 1.52, netMargin: 7.48, roa: 5.00, debtToEquity: 1.61, revenueGrowth: 5.5 }
            }
          }
        },
        submittedAt: daysAgo(2),
        createdAt: daysAgo(2),
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
          conclusion: "Dossier nécessitant un suivi rapproché",
          financialData: {
            2024: {
              multiyear_data: { N: { data: { chiffre_affaires: 13500000, total_actif: 22000000, capitaux_propres: 7800000, resultat_net: 850000, actif_immobilise: 14000000, stocks: 3200000, creances_clients: 2100000, tresorerie_actif: 680000, dettes_fournisseurs: 1800000, dettes_financieres: 9500000, total_passif: 22000000 } } },
              ratios: { currentRatio: 1.43, netMargin: 6.30, roa: 3.86, debtToEquity: 1.82, revenueGrowth: 9.8 }
            },
            2023: {
              multiyear_data: { N: { data: { chiffre_affaires: 12290000, total_actif: 20000000, capitaux_propres: 7100000, resultat_net: 720000, actif_immobilise: 12800000, stocks: 2900000, creances_clients: 1900000, tresorerie_actif: 590000, dettes_fournisseurs: 1600000, dettes_financieres: 8700000, total_passif: 20000000 } } },
              ratios: { currentRatio: 1.35, netMargin: 5.86, roa: 3.60, debtToEquity: 1.96, revenueGrowth: 6.4 }
            },
            2022: {
              multiyear_data: { N: { data: { chiffre_affaires: 11550000, total_actif: 18500000, capitaux_propres: 6500000, resultat_net: 620000, actif_immobilise: 11800000, stocks: 2600000, creances_clients: 1700000, tresorerie_actif: 510000, dettes_fournisseurs: 1450000, dettes_financieres: 8000000, total_passif: 18500000 } } },
              ratios: { currentRatio: 1.27, netMargin: 5.37, roa: 3.35, debtToEquity: 2.15, revenueGrowth: 4.1 }
            }
          }
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
          conclusion: "Dossier excellent - approbation recommandée",
          financialData: {
            2024: {
              multiyear_data: { N: { data: { chiffre_affaires: 2850000, total_actif: 4100000, capitaux_propres: 1950000, resultat_net: 310000, actif_immobilise: 2400000, stocks: 420000, creances_clients: 580000, tresorerie_actif: 290000, dettes_fournisseurs: 380000, dettes_financieres: 1200000, total_passif: 4100000 } } },
              ratios: { currentRatio: 1.87, netMargin: 10.88, roa: 7.56, debtToEquity: 1.10, revenueGrowth: 15.3 }
            },
            2023: {
              multiyear_data: { N: { data: { chiffre_affaires: 2472000, total_actif: 3600000, capitaux_propres: 1680000, resultat_net: 258000, actif_immobilise: 2100000, stocks: 370000, creances_clients: 490000, tresorerie_actif: 240000, dettes_fournisseurs: 330000, dettes_financieres: 1050000, total_passif: 3600000 } } },
              ratios: { currentRatio: 1.75, netMargin: 10.44, roa: 7.17, debtToEquity: 1.24, revenueGrowth: 11.2 }
            },
            2022: {
              multiyear_data: { N: { data: { chiffre_affaires: 2223000, total_actif: 3200000, capitaux_propres: 1460000, resultat_net: 215000, actif_immobilise: 1850000, stocks: 320000, creances_clients: 430000, tresorerie_actif: 200000, dettes_fournisseurs: 290000, dettes_financieres: 920000, total_passif: 3200000 } } },
              ratios: { currentRatio: 1.64, netMargin: 9.67, roa: 6.72, debtToEquity: 1.40, revenueGrowth: 7.8 }
            }
          }
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
          conclusion: "Projet viable avec un bon potentiel de croissance",
          financialData: {
            2024: {
              multiyear_data: { N: { data: { chiffre_affaires: 7900000, total_actif: 11500000, capitaux_propres: 4200000, resultat_net: 580000, actif_immobilise: 5200000, stocks: 2800000, creances_clients: 1600000, tresorerie_actif: 520000, dettes_fournisseurs: 1400000, dettes_financieres: 4500000, total_passif: 11500000 } } },
              ratios: { currentRatio: 1.68, netMargin: 7.34, roa: 5.04, debtToEquity: 1.74, revenueGrowth: 10.5 }
            },
            2023: {
              multiyear_data: { N: { data: { chiffre_affaires: 7149000, total_actif: 10400000, capitaux_propres: 3750000, resultat_net: 490000, actif_immobilise: 4700000, stocks: 2550000, creances_clients: 1400000, tresorerie_actif: 450000, dettes_fournisseurs: 1250000, dettes_financieres: 4100000, total_passif: 10400000 } } },
              ratios: { currentRatio: 1.56, netMargin: 6.86, roa: 4.71, debtToEquity: 1.89, revenueGrowth: 7.3 }
            },
            2022: {
              multiyear_data: { N: { data: { chiffre_affaires: 6663000, total_actif: 9600000, capitaux_propres: 3350000, resultat_net: 420000, actif_immobilise: 4300000, stocks: 2300000, creances_clients: 1250000, tresorerie_actif: 390000, dettes_fournisseurs: 1100000, dettes_financieres: 3800000, total_passif: 9600000 } } },
              ratios: { currentRatio: 1.48, netMargin: 6.30, roa: 4.38, debtToEquity: 2.06, revenueGrowth: 5.1 }
            }
          }
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
          conclusion: "Risque trop élevé dans les conditions actuelles",
          financialData: {
            2024: {
              multiyear_data: { N: { data: { chiffre_affaires: 21000000, total_actif: 38000000, capitaux_propres: 7500000, resultat_net: 580000, actif_immobilise: 28000000, stocks: 5200000, creances_clients: 2800000, tresorerie_actif: 420000, dettes_fournisseurs: 3200000, dettes_financieres: 22000000, total_passif: 38000000 } } },
              ratios: { currentRatio: 0.98, netMargin: 2.76, roa: 1.53, debtToEquity: 4.07, revenueGrowth: 3.2 }
            },
            2023: {
              multiyear_data: { N: { data: { chiffre_affaires: 20350000, total_actif: 36500000, capitaux_propres: 7100000, resultat_net: 490000, actif_immobilise: 27000000, stocks: 4900000, creances_clients: 2600000, tresorerie_actif: 380000, dettes_fournisseurs: 3000000, dettes_financieres: 21000000, total_passif: 36500000 } } },
              ratios: { currentRatio: 0.91, netMargin: 2.41, roa: 1.34, debtToEquity: 4.37, revenueGrowth: 1.8 }
            },
            2022: {
              multiyear_data: { N: { data: { chiffre_affaires: 19990000, total_actif: 35000000, capitaux_propres: 6700000, resultat_net: 390000, actif_immobilise: 26000000, stocks: 4600000, creances_clients: 2400000, tresorerie_actif: 340000, dettes_fournisseurs: 2800000, dettes_financieres: 20000000, total_passif: 35000000 } } },
              ratios: { currentRatio: 0.85, netMargin: 1.95, roa: 1.11, debtToEquity: 4.78, revenueGrowth: -0.5 }
            }
          }
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
          conclusion: "Excellent projet avec fort potentiel d'exportation",
          financialData: {
            2024: {
              multiyear_data: { N: { data: { chiffre_affaires: 10500000, total_actif: 16000000, capitaux_propres: 6800000, resultat_net: 980000, actif_immobilise: 9500000, stocks: 2800000, creances_clients: 1900000, tresorerie_actif: 750000, dettes_fournisseurs: 1500000, dettes_financieres: 5800000, total_passif: 16000000 } } },
              ratios: { currentRatio: 1.93, netMargin: 9.33, roa: 6.13, debtToEquity: 1.35, revenueGrowth: 18.2 }
            },
            2023: {
              multiyear_data: { N: { data: { chiffre_affaires: 8884000, total_actif: 14000000, capitaux_propres: 5900000, resultat_net: 820000, actif_immobilise: 8200000, stocks: 2400000, creances_clients: 1650000, tresorerie_actif: 620000, dettes_fournisseurs: 1300000, dettes_financieres: 5100000, total_passif: 14000000 } } },
              ratios: { currentRatio: 1.81, netMargin: 9.23, roa: 5.86, debtToEquity: 1.53, revenueGrowth: 14.5 }
            },
            2022: {
              multiyear_data: { N: { data: { chiffre_affaires: 7760000, total_actif: 12200000, capitaux_propres: 5100000, resultat_net: 690000, actif_immobilise: 7100000, stocks: 2100000, creances_clients: 1450000, tresorerie_actif: 530000, dettes_fournisseurs: 1150000, dettes_financieres: 4500000, total_passif: 12200000 } } },
              ratios: { currentRatio: 1.70, netMargin: 8.89, roa: 5.66, debtToEquity: 1.75, revenueGrowth: 10.8 }
            }
          }
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
          conclusion: "Projet acceptable mais nécessite un suivi attentif",
          financialData: {
            2024: {
              multiyear_data: { N: { data: { chiffre_affaires: 16200000, total_actif: 24500000, capitaux_propres: 8100000, resultat_net: 750000, actif_immobilise: 17500000, stocks: 2100000, creances_clients: 2800000, tresorerie_actif: 590000, dettes_fournisseurs: 1900000, dettes_financieres: 11800000, total_passif: 24500000 } } },
              ratios: { currentRatio: 1.41, netMargin: 4.63, roa: 3.06, debtToEquity: 2.02, revenueGrowth: 7.9 }
            },
            2023: {
              multiyear_data: { N: { data: { chiffre_affaires: 15014000, total_actif: 22800000, capitaux_propres: 7500000, resultat_net: 650000, actif_immobilise: 16200000, stocks: 1900000, creances_clients: 2500000, tresorerie_actif: 520000, dettes_fournisseurs: 1750000, dettes_financieres: 11000000, total_passif: 22800000 } } },
              ratios: { currentRatio: 1.34, netMargin: 4.33, roa: 2.85, debtToEquity: 2.20, revenueGrowth: 5.4 }
            },
            2022: {
              multiyear_data: { N: { data: { chiffre_affaires: 14243000, total_actif: 21500000, capitaux_propres: 7000000, resultat_net: 570000, actif_immobilise: 15300000, stocks: 1700000, creances_clients: 2300000, tresorerie_actif: 470000, dettes_fournisseurs: 1600000, dettes_financieres: 10300000, total_passif: 21500000 } } },
              ratios: { currentRatio: 1.27, netMargin: 4.00, roa: 2.65, debtToEquity: 2.40, revenueGrowth: 3.2 }
            }
          }
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
          conclusion: "Financement agricole standard avec garanties appropriées",
          financialData: {
            2024: {
              multiyear_data: { N: { data: { chiffre_affaires: 5900000, total_actif: 8500000, capitaux_propres: 3400000, resultat_net: 460000, actif_immobilise: 3800000, stocks: 2600000, creances_clients: 980000, tresorerie_actif: 310000, dettes_fournisseurs: 850000, dettes_financieres: 3000000, total_passif: 8500000 } } },
              ratios: { currentRatio: 1.55, netMargin: 7.80, roa: 5.41, debtToEquity: 1.50, revenueGrowth: 8.5 }
            },
            2023: {
              multiyear_data: { N: { data: { chiffre_affaires: 5438000, total_actif: 7800000, capitaux_propres: 3050000, resultat_net: 390000, actif_immobilise: 3400000, stocks: 2350000, creances_clients: 870000, tresorerie_actif: 270000, dettes_fournisseurs: 760000, dettes_financieres: 2700000, total_passif: 7800000 } } },
              ratios: { currentRatio: 1.46, netMargin: 7.17, roa: 5.00, debtToEquity: 1.66, revenueGrowth: 5.2 }
            },
            2022: {
              multiyear_data: { N: { data: { chiffre_affaires: 5170000, total_actif: 7200000, capitaux_propres: 2780000, resultat_net: 330000, actif_immobilise: 3100000, stocks: 2150000, creances_clients: 780000, tresorerie_actif: 240000, dettes_fournisseurs: 690000, dettes_financieres: 2450000, total_passif: 7200000 } } },
              ratios: { currentRatio: 1.38, netMargin: 6.38, roa: 4.58, debtToEquity: 1.82, revenueGrowth: 3.0 }
            }
          }
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
          conclusion: "Secteur prometteur avec management expérimenté",
          financialData: {
            2024: {
              multiyear_data: { N: { data: { chiffre_affaires: 8700000, total_actif: 12800000, capitaux_propres: 5200000, resultat_net: 820000, actif_immobilise: 7200000, stocks: 3100000, creances_clients: 1450000, tresorerie_actif: 580000, dettes_fournisseurs: 1100000, dettes_financieres: 4900000, total_passif: 12800000 } } },
              ratios: { currentRatio: 1.89, netMargin: 9.43, roa: 6.41, debtToEquity: 1.46, revenueGrowth: 14.5 }
            },
            2023: {
              multiyear_data: { N: { data: { chiffre_affaires: 7598000, total_actif: 11200000, capitaux_propres: 4550000, resultat_net: 690000, actif_immobilise: 6300000, stocks: 2800000, creances_clients: 1250000, tresorerie_actif: 490000, dettes_fournisseurs: 960000, dettes_financieres: 4350000, total_passif: 11200000 } } },
              ratios: { currentRatio: 1.79, netMargin: 9.08, roa: 6.16, debtToEquity: 1.63, revenueGrowth: 11.2 }
            },
            2022: {
              multiyear_data: { N: { data: { chiffre_affaires: 6832000, total_actif: 10000000, capitaux_propres: 4050000, resultat_net: 580000, actif_immobilise: 5600000, stocks: 2550000, creances_clients: 1100000, tresorerie_actif: 420000, dettes_fournisseurs: 860000, dettes_financieres: 3900000, total_passif: 10000000 } } },
              ratios: { currentRatio: 1.68, netMargin: 8.49, roa: 5.80, debtToEquity: 1.84, revenueGrowth: 8.1 }
            }
          }
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
          conclusion: "Bon potentiel avec suivi des développements technologiques",
          financialData: {
            2024: {
              multiyear_data: { N: { data: { chiffre_affaires: 3850000, total_actif: 5600000, capitaux_propres: 2300000, resultat_net: 340000, actif_immobilise: 2100000, stocks: 580000, creances_clients: 1450000, tresorerie_actif: 420000, dettes_fournisseurs: 680000, dettes_financieres: 2000000, total_passif: 5600000 } } },
              ratios: { currentRatio: 1.65, netMargin: 8.83, roa: 6.07, debtToEquity: 1.43, revenueGrowth: 12.4 }
            },
            2023: {
              multiyear_data: { N: { data: { chiffre_affaires: 3425000, total_actif: 5000000, capitaux_propres: 2050000, resultat_net: 285000, actif_immobilise: 1850000, stocks: 510000, creances_clients: 1280000, tresorerie_actif: 360000, dettes_fournisseurs: 610000, dettes_financieres: 1800000, total_passif: 5000000 } } },
              ratios: { currentRatio: 1.57, netMargin: 8.32, roa: 5.70, debtToEquity: 1.59, revenueGrowth: 9.1 }
            },
            2022: {
              multiyear_data: { N: { data: { chiffre_affaires: 3139000, total_actif: 4600000, capitaux_propres: 1840000, resultat_net: 240000, actif_immobilise: 1680000, stocks: 460000, creances_clients: 1150000, tresorerie_actif: 310000, dettes_fournisseurs: 550000, dettes_financieres: 1650000, total_passif: 4600000 } } },
              ratios: { currentRatio: 1.49, netMargin: 7.65, roa: 5.22, debtToEquity: 1.78, revenueGrowth: 6.5 }
            }
          }
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
          conclusion: "Projet innovant mais risques financiers trop élevés",
          financialData: {
            2024: {
              multiyear_data: { N: { data: { chiffre_affaires: 18500000, total_actif: 28000000, capitaux_propres: 5800000, resultat_net: 620000, actif_immobilise: 16000000, stocks: 2900000, creances_clients: 5200000, tresorerie_actif: 480000, dettes_fournisseurs: 3100000, dettes_financieres: 16000000, total_passif: 28000000 } } },
              ratios: { currentRatio: 0.95, netMargin: 3.35, roa: 2.21, debtToEquity: 3.83, revenueGrowth: 5.7 }
            },
            2023: {
              multiyear_data: { N: { data: { chiffre_affaires: 17500000, total_actif: 26500000, capitaux_propres: 5400000, resultat_net: 530000, actif_immobilise: 15200000, stocks: 2700000, creances_clients: 4900000, tresorerie_actif: 420000, dettes_fournisseurs: 2900000, dettes_financieres: 15000000, total_passif: 26500000 } } },
              ratios: { currentRatio: 0.89, netMargin: 3.03, roa: 2.00, debtToEquity: 4.13, revenueGrowth: 3.2 }
            },
            2022: {
              multiyear_data: { N: { data: { chiffre_affaires: 16960000, total_actif: 25200000, capitaux_propres: 5100000, resultat_net: 450000, actif_immobilise: 14500000, stocks: 2500000, creances_clients: 4600000, tresorerie_actif: 370000, dettes_fournisseurs: 2700000, dettes_financieres: 14300000, total_passif: 25200000 } } },
              ratios: { currentRatio: 0.84, netMargin: 2.65, roa: 1.79, debtToEquity: 4.49, revenueGrowth: 1.5 }
            }
          }
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
          conclusion: "Projet immobilier solide dans un marché porteur",
          financialData: {
            2024: {
              multiyear_data: { N: { data: { chiffre_affaires: 29500000, total_actif: 52000000, capitaux_propres: 18500000, resultat_net: 2400000, actif_immobilise: 35000000, stocks: 8500000, creances_clients: 4200000, tresorerie_actif: 1200000, dettes_fournisseurs: 3800000, dettes_financieres: 22000000, total_passif: 52000000 } } },
              ratios: { currentRatio: 1.72, netMargin: 8.14, roa: 4.62, debtToEquity: 1.81, revenueGrowth: 16.5 }
            },
            2023: {
              multiyear_data: { N: { data: { chiffre_affaires: 25322000, total_actif: 47000000, capitaux_propres: 16500000, resultat_net: 2050000, actif_immobilise: 31500000, stocks: 7600000, creances_clients: 3800000, tresorerie_actif: 1050000, dettes_fournisseurs: 3400000, dettes_financieres: 20000000, total_passif: 47000000 } } },
              ratios: { currentRatio: 1.63, netMargin: 8.10, roa: 4.36, debtToEquity: 1.97, revenueGrowth: 12.3 }
            },
            2022: {
              multiyear_data: { N: { data: { chiffre_affaires: 22549000, total_actif: 42500000, capitaux_propres: 14800000, resultat_net: 1750000, actif_immobilise: 28500000, stocks: 6800000, creances_clients: 3400000, tresorerie_actif: 920000, dettes_fournisseurs: 3000000, dettes_financieres: 18000000, total_passif: 42500000 } } },
              ratios: { currentRatio: 1.54, netMargin: 7.76, roa: 4.12, debtToEquity: 2.18, revenueGrowth: 9.1 }
            }
          }
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
          conclusion: "Secteur touristique avec potentiel mais volatil",
          financialData: {
            2024: {
              multiyear_data: { N: { data: { chiffre_affaires: 13200000, total_actif: 22000000, capitaux_propres: 7900000, resultat_net: 980000, actif_immobilise: 16500000, stocks: 1200000, creances_clients: 1800000, tresorerie_actif: 980000, dettes_fournisseurs: 1200000, dettes_financieres: 10000000, total_passif: 22000000 } } },
              ratios: { currentRatio: 1.78, netMargin: 7.42, roa: 4.45, debtToEquity: 1.78, revenueGrowth: 11.2 }
            },
            2023: {
              multiyear_data: { N: { data: { chiffre_affaires: 11871000, total_actif: 20500000, capitaux_propres: 7200000, resultat_net: 840000, actif_immobilise: 15300000, stocks: 1050000, creances_clients: 1620000, tresorerie_actif: 850000, dettes_fournisseurs: 1100000, dettes_financieres: 9200000, total_passif: 20500000 } } },
              ratios: { currentRatio: 1.68, netMargin: 7.08, roa: 4.10, debtToEquity: 1.97, revenueGrowth: 8.5 }
            },
            2022: {
              multiyear_data: { N: { data: { chiffre_affaires: 10943000, total_actif: 19200000, capitaux_propres: 6700000, resultat_net: 720000, actif_immobilise: 14300000, stocks: 960000, creances_clients: 1480000, tresorerie_actif: 760000, dettes_fournisseurs: 1000000, dettes_financieres: 8600000, total_passif: 19200000 } } },
              ratios: { currentRatio: 1.58, netMargin: 6.58, roa: 3.75, debtToEquity: 2.19, revenueGrowth: 5.8 }
            }
          }
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
          conclusion: "Secteur profitable avec débouchés à l'export garantis",
          financialData: {
            2024: {
              multiyear_data: { N: { data: { chiffre_affaires: 24800000, total_actif: 38500000, capitaux_propres: 16800000, resultat_net: 2600000, actif_immobilise: 29000000, stocks: 3500000, creances_clients: 3200000, tresorerie_actif: 1450000, dettes_fournisseurs: 2200000, dettes_financieres: 16500000, total_passif: 38500000 } } },
              ratios: { currentRatio: 1.95, netMargin: 10.48, roa: 6.75, debtToEquity: 1.29, revenueGrowth: 13.5 }
            },
            2023: {
              multiyear_data: { N: { data: { chiffre_affaires: 21850000, total_actif: 35000000, capitaux_propres: 15200000, resultat_net: 2250000, actif_immobilise: 26500000, stocks: 3100000, creances_clients: 2900000, tresorerie_actif: 1250000, dettes_fournisseurs: 2000000, dettes_financieres: 15000000, total_passif: 35000000 } } },
              ratios: { currentRatio: 1.85, netMargin: 10.30, roa: 6.43, debtToEquity: 1.43, revenueGrowth: 10.8 }
            },
            2022: {
              multiyear_data: { N: { data: { chiffre_affaires: 19720000, total_actif: 32000000, capitaux_propres: 13800000, resultat_net: 1980000, actif_immobilise: 24000000, stocks: 2800000, creances_clients: 2650000, tresorerie_actif: 1100000, dettes_fournisseurs: 1800000, dettes_financieres: 13800000, total_passif: 32000000 } } },
              ratios: { currentRatio: 1.74, netMargin: 10.04, roa: 6.19, debtToEquity: 1.59, revenueGrowth: 8.2 }
            }
          }
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
          conclusion: "Projet exemplaire dans les énergies renouvelables",
          financialData: {
            2024: {
              multiyear_data: { N: { data: { chiffre_affaires: 17500000, total_actif: 32000000, capitaux_propres: 18000000, resultat_net: 2900000, actif_immobilise: 28000000, stocks: 1200000, creances_clients: 1500000, tresorerie_actif: 1800000, dettes_fournisseurs: 800000, dettes_financieres: 10000000, total_passif: 32000000 } } },
              ratios: { currentRatio: 2.52, netMargin: 16.57, roa: 9.06, debtToEquity: 0.78, revenueGrowth: 22.4 }
            },
            2023: {
              multiyear_data: { N: { data: { chiffre_affaires: 14297000, total_actif: 28000000, capitaux_propres: 15800000, resultat_net: 2400000, actif_immobilise: 24500000, stocks: 980000, creances_clients: 1280000, tresorerie_actif: 1500000, dettes_fournisseurs: 700000, dettes_financieres: 8800000, total_passif: 28000000 } } },
              ratios: { currentRatio: 2.38, netMargin: 16.79, roa: 8.57, debtToEquity: 0.90, revenueGrowth: 18.6 }
            },
            2022: {
              multiyear_data: { N: { data: { chiffre_affaires: 12057000, total_actif: 24000000, capitaux_propres: 13800000, resultat_net: 1950000, actif_immobilise: 21000000, stocks: 800000, creances_clients: 1100000, tresorerie_actif: 1250000, dettes_fournisseurs: 600000, dettes_financieres: 7700000, total_passif: 24000000 } } },
              ratios: { currentRatio: 2.24, netMargin: 16.17, roa: 8.13, debtToEquity: 1.04, revenueGrowth: 15.2 }
            }
          }
        },
        submittedAt: daysAgo(60),
        createdBy: 'user8'
      }
    })
  ]);

  console.log('📋 Created credit applications');

  // Create workflow steps
  // Logic:
  //   ≤ 10M XOF  → analyst + branch_manager (2 steps)
  //   10M–50M    → analyst + branch_manager + credit_committee (3 steps)
  //   > 50M      → analyst + branch_manager + credit_committee + management (4 steps)
  //   Duration > 60 months → add management step regardless of amount
  //   UNDER_REVIEW: last completed step + next step IN_PROGRESS + remaining PENDING
  //   REJECTED: all steps up to reject COMPLETED (last one REJECT decision)
  //   APPROVED: all required steps COMPLETED APPROVE

  const ws = (id: string, appId: string, stepName: string, role: any, assigneeId: string | null,
    status: string, daysAgoCompleted: number | null, decision: string | null, comment: string, deadlineDaysFromNow = 7): any => ({
    id,
    applicationId: appId,
    stepName,
    role,
    ...(assigneeId ? { assigneeId } : {}),
    status,
    deadline: new Date(now.getTime() + deadlineDaysFromNow * 24 * 60 * 60 * 1000),
    ...(decision ? { decision } : {}),
    ...(daysAgoCompleted !== null ? { completedAt: daysAgo(daysAgoCompleted) } : {}),
    ...(comment ? { comments: comment } : {}),
  });

  const workflowSteps = await Promise.all([

    // ── app1 · 5M · 24m · UNDER_REVIEW ────────────────────────────────────────
    // analyst done, branch_manager en cours
    prisma.workflowStep.create({ data: ws('ws1','app1','credit_analysis','CREDIT_ANALYST','user2','COMPLETED',1,'APPROVE','Analyse financière favorable, ratios dans les normes') }),
    prisma.workflowStep.create({ data: ws('ws2','app1','branch_manager_review','BRANCH_MANAGER','user3','IN_REVIEW',null,null,'En attente de validation du directeur agence') }),

    // ── app2 · 15M · 36m · UNDER_REVIEW ──────────────────────────────────────
    // analyst done, branch_manager en cours, committee pending
    prisma.workflowStep.create({ data: ws('ws3','app2','credit_analysis','CREDIT_ANALYST','user2','COMPLETED',2,'APPROVE','Dossier industriel solide, équipements bien valorisés') }),
    prisma.workflowStep.create({ data: ws('ws4','app2','branch_manager_review','BRANCH_MANAGER','user3','IN_REVIEW',null,null,'Révision en cours par le directeur agence') }),
    prisma.workflowStep.create({ data: ws('ws5','app2','credit_committee_review','CREDIT_COMMITTEE',null,'PENDING',null,null,'En attente passage en comité de crédit') }),

    // ── app3 · 3M · 18m · APPROVED ────────────────────────────────────────────
    // 2 étapes complètes
    prisma.workflowStep.create({ data: ws('ws6','app3','credit_analysis','CREDIT_ANALYST','user2','COMPLETED',8,'APPROVE','Excellente gestion de la trésorerie, croissance régulière') }),
    prisma.workflowStep.create({ data: ws('ws7','app3','branch_manager_review','BRANCH_MANAGER','user3','COMPLETED',6,'APPROVE','Dossier transport fiable, garanties suffisantes') }),

    // ── app4 · 8.5M · 30m · APPROVED ─────────────────────────────────────────
    // 2 étapes complètes (< 10M)
    prisma.workflowStep.create({ data: ws('ws8','app4','credit_analysis','CREDIT_ANALYST','user2','COMPLETED',14,'APPROVE','Distribution alimentaire bien positionnée, marché porteur') }),
    prisma.workflowStep.create({ data: ws('ws9','app4','branch_manager_review','BRANCH_MANAGER','user3','COMPLETED',12,'APPROVE','Garanties hypothécaires suffisantes, projet approuvé') }),

    // ── app5 · 25M · 48m · REJECTED ──────────────────────────────────────────
    // analyst + branch_manager complètes, rejet au comité
    prisma.workflowStep.create({ data: ws('ws10','app5','credit_analysis','CREDIT_ANALYST','user2','COMPLETED',16,'APPROVE','Secteur en place mais structure financière tendue') }),
    prisma.workflowStep.create({ data: ws('ws11','app5','branch_manager_review','BRANCH_MANAGER','user3','COMPLETED',15,'APPROVE','Transmis au comité avec réserves sur l\'endettement') }),
    prisma.workflowStep.create({ data: ws('ws12','app5','credit_committee_review','CREDIT_COMMITTEE','user4','COMPLETED',14,'REJECT','Ratio d\'endettement 4.07x, liquidité insuffisante — dossier refusé en comité') }),

    // ── app6 · 12M · 36m · APPROVED ──────────────────────────────────────────
    // 3 étapes complètes (> 10M)
    prisma.workflowStep.create({ data: ws('ws13','app6','credit_analysis','CREDIT_ANALYST','user2','COMPLETED',20,'APPROVE','Innovation produit avérée, marché export identifié') }),
    prisma.workflowStep.create({ data: ws('ws14','app6','branch_manager_review','BRANCH_MANAGER','user3','COMPLETED',18,'APPROVE','Secteur agroalimentaire porteur, management solide') }),
    prisma.workflowStep.create({ data: ws('ws15','app6','credit_committee_review','CREDIT_COMMITTEE','user4','COMPLETED',16,'APPROVE','Approuvé en comité — fort potentiel d\'exportation') }),

    // ── app7 · 18M · 42m · UNDER_REVIEW ──────────────────────────────────────
    // analyst done, branch_manager en cours, committee pending
    prisma.workflowStep.create({ data: ws('ws16','app7','credit_analysis','CREDIT_ANALYST','user2','COMPLETED',3,'APPROVE','Flotte transport vérifiée, licences en règle') }),
    prisma.workflowStep.create({ data: ws('ws17','app7','branch_manager_review','BRANCH_MANAGER','user3','IN_REVIEW',null,null,'Validation en cours du parc véhicules') }),
    prisma.workflowStep.create({ data: ws('ws18','app7','credit_committee_review','CREDIT_COMMITTEE',null,'PENDING',null,null,'En attente comité — dépasse le seuil directeur agence') }),

    // ── app8 · 6.5M · 12m · APPROVED ─────────────────────────────────────────
    // 2 étapes complètes (≤ 10M, court terme)
    prisma.workflowStep.create({ data: ws('ws19','app8','credit_analysis','CREDIT_ANALYST','user2','COMPLETED',27,'APPROVE','Coopérative agricole bien structurée, débouchés garantis') }),
    prisma.workflowStep.create({ data: ws('ws20','app8','branch_manager_review','BRANCH_MANAGER','user3','COMPLETED',25,'APPROVE','Financement campagne agricole approuvé, nantissement sur récolte validé') }),

    // ── app9 · 9.5M · 24m · APPROVED ─────────────────────────────────────────
    // 2 étapes complètes (< 10M)
    prisma.workflowStep.create({ data: ws('ws21','app9','credit_analysis','CREDIT_ANALYST','user2','COMPLETED',30,'APPROVE','Secteur avicole porteur, expérience technique avérée') }),
    prisma.workflowStep.create({ data: ws('ws22','app9','branch_manager_review','BRANCH_MANAGER','user3','COMPLETED',28,'APPROVE','Installations hypothéquées, projet approuvé sans réserve') }),

    // ── app10 · 4.5M · 18m · APPROVED ────────────────────────────────────────
    // 2 étapes complètes (< 10M)
    prisma.workflowStep.create({ data: ws('ws23','app10','credit_analysis','CREDIT_ANALYST','user2','COMPLETED',37,'APPROVE','Équipe IT qualifiée, contrats clients stables') }),
    prisma.workflowStep.create({ data: ws('ws24','app10','branch_manager_review','BRANCH_MANAGER','user3','COMPLETED',35,'APPROVE','Secteur numérique en croissance, caution personnelle acceptée') }),

    // ── app11 · 22M · 36m · REJECTED ─────────────────────────────────────────
    // analyst + branch_manager + rejet au comité
    prisma.workflowStep.create({ data: ws('ws25','app11','credit_analysis','CREDIT_ANALYST','user2','COMPLETED',44,'APPROVE','Innovation intéressante mais liquidité préoccupante') }),
    prisma.workflowStep.create({ data: ws('ws26','app11','branch_manager_review','BRANCH_MANAGER','user3','COMPLETED',43,'APPROVE','Transmis au comité avec mise en garde sur les fonds propres') }),
    prisma.workflowStep.create({ data: ws('ws27','app11','credit_committee_review','CREDIT_COMMITTEE','user4','COMPLETED',42,'REJECT','Fonds propres insuffisants (ratio 3.83x), liquidité < 1 — refusé en comité') }),

    // ── app12 · 35M · 60m · APPROVED ─────────────────────────────────────────
    // 3 étapes complètes (> 10M, ≤ 50M)
    prisma.workflowStep.create({ data: ws('ws28','app12','credit_analysis','CREDIT_ANALYST','user2','COMPLETED',47,'APPROVE','Promoteur immobilier expérimenté, demande de logements forte') }),
    prisma.workflowStep.create({ data: ws('ws29','app12','branch_manager_review','BRANCH_MANAGER','user3','COMPLETED',46,'APPROVE','Hypothèque sur terrain et constructions validée') }),
    prisma.workflowStep.create({ data: ws('ws30','app12','credit_committee_review','CREDIT_COMMITTEE','user4','COMPLETED',45,'APPROVE','Comité approuve — emplacement stratégique, précommercialisation en cours') }),

    // ── app13 · 15.5M · 48m · UNDER_REVIEW ───────────────────────────────────
    // analyst + branch_manager done, committee en cours
    prisma.workflowStep.create({ data: ws('ws31','app13','credit_analysis','CREDIT_ANALYST','user2','COMPLETED',6,'APPROVE','Hôtel bien situé, saison haute rentable') }),
    prisma.workflowStep.create({ data: ws('ws32','app13','branch_manager_review','BRANCH_MANAGER','user3','COMPLETED',5,'APPROVE','Hypothèque hôtelière acceptée, plan marketing à renforcer') }),
    prisma.workflowStep.create({ data: ws('ws33','app13','credit_committee_review','CREDIT_COMMITTEE','user4','IN_REVIEW',null,null,'Examen en comité — saisonnalité à modéliser') }),

    // ── app14 · 28M · 84m · APPROVED ─────────────────────────────────────────
    // 4 étapes complètes (durée > 60m → management requis)
    prisma.workflowStep.create({ data: ws('ws34','app14','credit_analysis','CREDIT_ANALYST','user2','COMPLETED',57,'APPROVE','Licences de pêche confirmées, marchés export documentés') }),
    prisma.workflowStep.create({ data: ws('ws35','app14','branch_manager_review','BRANCH_MANAGER','user3','COMPLETED',56,'APPROVE','Hypothèque maritime validée, assurance à souscrire') }),
    prisma.workflowStep.create({ data: ws('ws36','app14','credit_committee_review','CREDIT_COMMITTEE','user4','COMPLETED',55,'APPROVE','Comité approuve — secteur profitable, contrats export sécurisés') }),
    prisma.workflowStep.create({ data: ws('ws37','app14','management_review','MANAGEMENT','user6','COMPLETED',54,'APPROVE','Direction générale approuve — dossier pêche industrielle stratégique') }),

    // ── app15 · 20M · 72m · APPROVED ─────────────────────────────────────────
    // 4 étapes complètes (durée > 60m → management requis)
    prisma.workflowStep.create({ data: ws('ws38','app15','credit_analysis','CREDIT_ANALYST','user2','COMPLETED',62,'APPROVE','Projet EnR exemplaire, subventions gouvernementales confirmées') }),
    prisma.workflowStep.create({ data: ws('ws39','app15','branch_manager_review','BRANCH_MANAGER','user3','COMPLETED',61,'APPROVE','Nantissement équipements solaires validé, contrats long terme en place') }),
    prisma.workflowStep.create({ data: ws('ws40','app15','credit_committee_review','CREDIT_COMMITTEE','user4','COMPLETED',60,'APPROVE','Comité approuve — ratios excellents, secteur d\'avenir prioritaire') }),
    prisma.workflowStep.create({ data: ws('ws41','app15','management_review','MANAGEMENT','user6','COMPLETED',59,'APPROVE','Direction générale approuve — projet aligné avec stratégie développement durable') }),

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

  // ── Limites d'approbation ──────────────────────────────────────────────────
  await prisma.approvalLimit.deleteMany();
  await Promise.all([
    prisma.approvalLimit.create({ data: {
      role: 'BRANCH_MANAGER',   displayName: 'Directeur Agence',
      minAmount: 0,              maxAmount: 10000000,
      currency: 'XOF',          reviewDuration: 3, isActive: true
    }}),
    prisma.approvalLimit.create({ data: {
      role: 'CREDIT_COMMITTEE', displayName: 'Comité de Crédit',
      minAmount: 10000001,       maxAmount: 50000000,
      currency: 'XOF',          reviewDuration: 5, isActive: true
    }}),
    prisma.approvalLimit.create({ data: {
      role: 'MANAGEMENT',       displayName: 'Direction Générale',
      minAmount: 50000001,       maxAmount: 999999999,
      currency: 'XOF',          reviewDuration: 7, isActive: true
    }}),
  ]);
  console.log('🔒 Created approval limits');

  // ── Types de crédit avec workflows ────────────────────────────────────────────
  await prisma.creditType.deleteMany();
  await prisma.creditTypeWorkflowStep.deleteMany();

  const creditTypeData = [
    {
      id: 'ct-court-terme',
      code: 'CT',
      name: 'Crédit Court Terme',
      description: 'Financement du fonds de roulement, durée ≤ 12 mois',
      defaultRate: 12.5, minRate: 10.0, maxRate: 18.0,
      minDuration: 1, maxDuration: 12, requiresCollateral: false,
      steps: [
        { order: 1, stepName: 'credit_analysis',       stepLabel: 'Analyse de crédit',           role: 'CREDIT_ANALYST',   durationDays: 2 },
        { order: 2, stepName: 'branch_manager_review', stepLabel: 'Validation Directeur Agence',  role: 'BRANCH_MANAGER',   durationDays: 2 },
      ]
    },
    {
      id: 'ct-moyen-terme',
      code: 'CMT',
      name: 'Crédit Moyen Terme',
      description: 'Investissements, durée 1-5 ans',
      defaultRate: 11.0, minRate: 9.0, maxRate: 15.0,
      minDuration: 13, maxDuration: 60, requiresCollateral: true,
      steps: [
        { order: 1, stepName: 'credit_analysis',         stepLabel: 'Analyse de crédit',           role: 'CREDIT_ANALYST',   durationDays: 3 },
        { order: 2, stepName: 'branch_manager_review',   stepLabel: 'Validation Directeur Agence',  role: 'BRANCH_MANAGER',   durationDays: 3 },
        { order: 3, stepName: 'credit_committee_review', stepLabel: 'Comité de Crédit',             role: 'CREDIT_COMMITTEE', durationDays: 5 },
      ]
    },
    {
      id: 'ct-long-terme',
      code: 'CLT',
      name: 'Crédit Long Terme',
      description: 'Grands investissements, durée > 5 ans',
      defaultRate: 10.0, minRate: 8.0, maxRate: 14.0,
      minDuration: 61, maxDuration: 240, requiresCollateral: true,
      steps: [
        { order: 1, stepName: 'credit_analysis',         stepLabel: 'Analyse de crédit',           role: 'CREDIT_ANALYST',   durationDays: 5 },
        { order: 2, stepName: 'branch_manager_review',   stepLabel: 'Validation Directeur Agence',  role: 'BRANCH_MANAGER',   durationDays: 3 },
        { order: 3, stepName: 'credit_committee_review', stepLabel: 'Comité de Crédit',             role: 'CREDIT_COMMITTEE', durationDays: 5 },
        { order: 4, stepName: 'management_review',       stepLabel: 'Direction Générale',           role: 'MANAGEMENT',       durationDays: 7 },
      ]
    },
    {
      id: 'ct-leasing',
      code: 'LEASE',
      name: 'Crédit-Bail (Leasing)',
      description: 'Financement par location avec option d\'achat',
      defaultRate: 13.0, minRate: 11.0, maxRate: 17.0,
      minDuration: 12, maxDuration: 60, requiresCollateral: false,
      steps: [
        { order: 1, stepName: 'credit_analysis',         stepLabel: 'Analyse de crédit',           role: 'CREDIT_ANALYST',   durationDays: 3 },
        { order: 2, stepName: 'credit_committee_review', stepLabel: 'Comité de Crédit',             role: 'CREDIT_COMMITTEE', durationDays: 5 },
        { order: 3, stepName: 'management_review',       stepLabel: 'Direction Générale',           role: 'MANAGEMENT',       durationDays: 5 },
      ]
    },
    {
      id: 'ct-decouvert',
      code: 'DEC',
      name: 'Découvert Autorisé',
      description: 'Ligne de crédit renouvelable',
      defaultRate: 15.0, minRate: 12.0, maxRate: 22.0,
      minDuration: 1, maxDuration: 12, requiresCollateral: false,
      steps: [
        { order: 1, stepName: 'credit_analysis',       stepLabel: 'Analyse de crédit',           role: 'CREDIT_ANALYST', durationDays: 1 },
        { order: 2, stepName: 'branch_manager_review', stepLabel: 'Validation Directeur Agence', role: 'BRANCH_MANAGER', durationDays: 1 },
      ]
    },
  ];

  for (const ct of creditTypeData) {
    const { steps, ...typeData } = ct;
    await prisma.creditType.create({
      data: {
        ...typeData,
        workflowSteps: {
          create: steps as any
        }
      }
    });
  }
  console.log('💳 Created credit types with workflow configurations');

  console.log('⏳ Pending approval steps already included in workflow steps above');

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