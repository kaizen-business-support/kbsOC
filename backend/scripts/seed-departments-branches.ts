import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedDepartmentsBranches() {
  console.log('🌱 Seeding departments and branches...');

  // Seed Departments
  const departments = [
    {
      name: 'Direction Générale',
      code: 'DG',
      description: 'Direction générale de l\'établissement',
      isActive: true
    },
    {
      name: 'Direction des Crédits',
      code: 'DC',
      description: 'Gestion et approbation des demandes de crédit',
      isActive: true
    },
    {
      name: 'Direction Financière',
      code: 'DF',
      description: 'Gestion financière et comptabilité',
      isActive: true
    },
    {
      name: 'Direction des Risques',
      code: 'DR',
      description: 'Analyse et gestion des risques',
      isActive: true
    },
    {
      name: 'Direction Commerciale',
      code: 'DCOM',
      description: 'Développement commercial et relation client',
      isActive: true
    },
    {
      name: 'Direction des Opérations',
      code: 'DO',
      description: 'Gestion des opérations bancaires',
      isActive: true
    },
    {
      name: 'Direction des Systèmes d\'Information',
      code: 'DSI',
      description: 'Gestion des systèmes informatiques',
      isActive: true
    },
    {
      name: 'Direction des Ressources Humaines',
      code: 'DRH',
      description: 'Gestion des ressources humaines',
      isActive: true
    }
  ];

  console.log('\n📂 Creating departments...');
  for (const dept of departments) {
    try {
      const existing = await prisma.department.findUnique({
        where: { code: dept.code }
      });

      if (existing) {
        await prisma.department.update({
          where: { code: dept.code },
          data: dept
        });
        console.log(`✅ Updated: ${dept.name} (${dept.code})`);
      } else {
        await prisma.department.create({
          data: dept
        });
        console.log(`✅ Created: ${dept.name} (${dept.code})`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${dept.name}:`, error);
    }
  }

  // Seed Branches
  const branches = [
    {
      name: 'Agence Dakar Plateau',
      code: 'DKR-PLT',
      address: 'Avenue Léopold Sédar Senghor',
      city: 'Dakar',
      country: 'Sénégal',
      manager: 'Mamadou Diop',
      isActive: true
    },
    {
      name: 'Agence Dakar Almadies',
      code: 'DKR-ALM',
      address: 'Route des Almadies',
      city: 'Dakar',
      country: 'Sénégal',
      manager: 'Aminata Fall',
      isActive: true
    },
    {
      name: 'Agence Thiès',
      code: 'THS',
      address: 'Avenue Lamine Gueye',
      city: 'Thiès',
      country: 'Sénégal',
      manager: 'Ousmane Sow',
      isActive: true
    },
    {
      name: 'Agence Saint-Louis',
      code: 'STL',
      address: 'Rue Blaise Diagne',
      city: 'Saint-Louis',
      country: 'Sénégal',
      manager: 'Fatou Ndiaye',
      isActive: true
    },
    {
      name: 'Agence Kaolack',
      code: 'KLK',
      address: 'Avenue Valdiodio Ndiaye',
      city: 'Kaolack',
      country: 'Sénégal',
      manager: 'Ibrahima Sarr',
      isActive: true
    },
    {
      name: 'Agence Ziguinchor',
      code: 'ZGC',
      address: 'Avenue du Général de Gaulle',
      city: 'Ziguinchor',
      country: 'Sénégal',
      manager: 'Marie Coly',
      isActive: true
    },
    {
      name: 'Agence Mbour',
      code: 'MBR',
      address: 'Route de Saly',
      city: 'Mbour',
      country: 'Sénégal',
      manager: 'Cheikh Dieng',
      isActive: true
    },
    {
      name: 'Agence Touba',
      code: 'TBA',
      address: 'Avenue Cheikh Ahmadou Bamba',
      city: 'Touba',
      country: 'Sénégal',
      manager: 'Serigne Mbacké',
      isActive: true
    },
    {
      name: 'Agence Rufisque',
      code: 'RFS',
      address: 'Boulevard du Centenaire',
      city: 'Rufisque',
      country: 'Sénégal',
      manager: 'Aïssatou Diallo',
      isActive: true
    },
    {
      name: 'Agence Louga',
      code: 'LGA',
      address: 'Avenue Abdoulaye Wade',
      city: 'Louga',
      country: 'Sénégal',
      manager: 'Moussa Ba',
      isActive: true
    }
  ];

  console.log('\n🏢 Creating branches...');
  for (const branch of branches) {
    try {
      const existing = await prisma.branch.findUnique({
        where: { code: branch.code }
      });

      if (existing) {
        await prisma.branch.update({
          where: { code: branch.code },
          data: branch
        });
        console.log(`✅ Updated: ${branch.name} (${branch.code})`);
      } else {
        await prisma.branch.create({
          data: branch
        });
        console.log(`✅ Created: ${branch.name} (${branch.code})`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${branch.name}:`, error);
    }
  }

  console.log('\n🎉 Departments and branches seeding complete!');

  // Display summary
  const departmentCount = await prisma.department.count();
  const branchCount = await prisma.branch.count();

  console.log('\n📊 Summary:');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`Departments: ${departmentCount}`);
  console.log(`Branches: ${branchCount}`);
  console.log('═══════════════════════════════════════════════════════════════════════\n');
}

seedDepartmentsBranches()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
